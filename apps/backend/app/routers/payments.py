import hashlib
import hmac
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy import select

from .. import models, mp, serializers
from ..config import API_PUBLIC_URL
from ..deps import DbDep, StaffContext, require_roles
from ..errors import not_found, unauthorized
from ..ids import new_id
from ..models import utcnow
from ..schemas import CreatePaymentDto, CreatePreferenceDto
from ..utils import parse_datetime

router = APIRouter(prefix="/api/payments", tags=["payments"])

Roles = Depends(require_roles("ADMIN", "OPERATOR"))


def _notification_url(request: Request) -> str:
    if API_PUBLIC_URL:
        return API_PUBLIC_URL
    base = str(request.base_url).rstrip("/")
    return f"{base}/api/payments/mercado-pago/webhook"


@router.post("", status_code=201)
def create(dto: CreatePaymentDto, db: DbDep, ctx: StaffContext = Roles):
    fee = db.get(models.Fee, dto.feeId)
    if not fee:
        raise not_found("Cuota no encontrada")

    pay = models.Payment(
        id=new_id(),
        memberId=fee.memberId,
        feeId=fee.id,
        amount=Decimal(dto.amount),
        method=dto.method,
        reference=dto.reference,
        paidAt=parse_datetime(dto.paidAt) if dto.paidAt else utcnow(),
        status="COMPLETED",
    )
    db.add(pay)
    db.flush()

    mp.update_fee_status(db, fee.id)
    db.commit()
    db.refresh(pay)
    return serializers.payment(pay)


@router.post("/mercado-pago/preference", status_code=201)
def create_preference(
    dto: CreatePreferenceDto, request: Request, db: DbDep, ctx: StaffContext = Roles
):
    fee = db.get(models.Fee, dto.feeId)
    if not fee:
        raise not_found("Cuota no encontrada")

    result = mp.create_preference(
        db,
        fee,
        unit_price=fee.amount,
        back_urls=mp.admin_back_urls(),
        notification_url=_notification_url(request),
    )

    fee.externalReference = result["preferenceId"]
    db.commit()
    return result


def _validate_signature(body: dict[str, Any], signature: str, secret: str) -> bool:
    # Formato de Mercado Pago: ts=timestamp,v1=hash
    parts = signature.split(",")
    ts_part = next((p for p in parts if p.startswith("ts=")), None)
    v1_part = next((p for p in parts if p.startswith("v1=")), None)
    if not ts_part or not v1_part:
        return False

    ts = ts_part.replace("ts=", "").strip()
    received_hash = v1_part.replace("v1=", "").strip()
    data_id = (body.get("data") or {}).get("id")
    if not data_id:
        return False

    template = f"id:{data_id}_ts:{ts}_secret:{secret}"
    computed = hmac.new(secret.encode(), template.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, received_hash)


# Webhook de MP: público, sin JWT
@router.post("/mercado-pago/webhook", status_code=201)
def webhook(
    body: dict[str, Any],
    db: DbDep,
    x_signature: str | None = Header(default=None),
):
    topic = body.get("type") or body.get("topic")
    data_id = (body.get("data") or {}).get("id")

    if topic != "payment" or not data_id:
        return {"received": True}

    secret = mp.webhook_secret(db)
    if secret:
        if not x_signature or not _validate_signature(body, x_signature, secret):
            raise unauthorized("Firma de webhook inválida")

    payment_data = mp.get_payment(db, str(data_id))
    status = mp.map_mp_status(payment_data.get("status"))
    external_reference = payment_data.get("external_reference")

    if not external_reference:
        return {"received": True}

    fee = db.get(models.Fee, external_reference)
    if not fee:
        return {"received": True}

    existing = db.scalar(
        select(models.Payment).where(
            models.Payment.reference == str(data_id),
            models.Payment.method == "MERCADO_PAGO",
        )
    )

    if existing:
        existing.status = status
    else:
        db.add(
            models.Payment(
                id=new_id(),
                memberId=fee.memberId,
                feeId=fee.id,
                amount=fee.amount,
                method="MERCADO_PAGO",
                status=status,
                reference=str(data_id),
                paidAt=utcnow() if status == "COMPLETED" else None,
            )
        )
    db.flush()

    if status == "COMPLETED":
        mp.update_fee_status(db, fee.id)

    db.commit()
    return {"received": True}
