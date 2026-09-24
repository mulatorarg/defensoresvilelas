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


def _validate_signature(
    data_id: str, signature: str, request_id: str | None, secret: str
) -> bool:
    """Valida el header x-signature de Mercado Pago.

    Formato: "ts=<timestamp>,v1=<hmac>". El HMAC-SHA256 (clave = secret) se
    calcula sobre el manifest "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
    omitiendo las partes que no vienen. Ver:
    https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
    """
    parts = dict(
        p.strip().split("=", 1) for p in signature.split(",") if "=" in p
    )
    ts = parts.get("ts")
    received_hash = parts.get("v1")
    if not ts or not received_hash:
        return False

    manifest = f"id:{data_id.lower() if data_id.isalnum() else data_id};"
    if request_id:
        manifest += f"request-id:{request_id};"
    manifest += f"ts:{ts};"
    computed = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, received_hash)


def _mp_amount(payment_data: dict[str, Any], fallback: Decimal) -> Decimal:
    raw = payment_data.get("transaction_amount")
    try:
        return Decimal(str(raw)) if raw is not None else fallback
    except (ArithmeticError, ValueError):
        return fallback


# Webhook de MP: público, sin JWT
@router.post("/mercado-pago/webhook", status_code=201)
def webhook(
    body: dict[str, Any],
    request: Request,
    db: DbDep,
    x_signature: str | None = Header(default=None),
    x_request_id: str | None = Header(default=None),
):
    topic = body.get("type") or body.get("topic")
    # MP firma el data.id que viaja en la query string (?data.id=...)
    data_id = request.query_params.get("data.id") or (body.get("data") or {}).get("id")

    if topic != "payment" or not data_id:
        return {"received": True}
    data_id = str(data_id)

    secret = mp.webhook_secret(db)
    if secret:
        if not x_signature or not _validate_signature(data_id, x_signature, x_request_id, secret):
            raise unauthorized("Firma de webhook inválida")

    # Se consulta el pago a la API de MP: el body del webhook no es confiable
    payment_data = mp.get_payment(db, data_id)
    status = mp.map_mp_status(payment_data.get("status"))
    external_reference = payment_data.get("external_reference")

    if not external_reference:
        return {"received": True}

    fee = db.get(models.Fee, external_reference)
    if not fee:
        return {"received": True}

    existing = db.scalar(
        select(models.Payment).where(
            models.Payment.reference == data_id,
            models.Payment.method == "MERCADO_PAGO",
        )
    )

    if existing:
        existing.status = status
        if status == "COMPLETED" and existing.paidAt is None:
            existing.paidAt = utcnow()
    else:
        db.add(
            models.Payment(
                id=new_id(),
                memberId=fee.memberId,
                feeId=fee.id,
                # Monto efectivamente cobrado (puede ser el saldo de una cuota parcial)
                amount=_mp_amount(payment_data, fee.amount - (fee.paidAmount or 0)),
                method="MERCADO_PAGO",
                status=status,
                reference=data_id,
                paidAt=utcnow() if status == "COMPLETED" else None,
            )
        )
    db.flush()

    # Siempre se recalcula: un pago aprobado que luego se reintegra baja el saldo
    mp.update_fee_status(db, fee.id)

    db.commit()
    return {"received": True}
