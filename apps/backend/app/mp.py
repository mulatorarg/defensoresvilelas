"""Integración con Mercado Pago.

Las credenciales viven en la tabla configuracion_club (editable desde el
admin) con fallback a variables de entorno.
"""
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .config import (
    FRONTEND_URL,
    MERCADO_PAGO_ACCESS_TOKEN,
    MERCADO_PAGO_WEBHOOK_SECRET,
)

try:
    import mercadopago  # type: ignore
except ImportError:  # pragma: no cover
    mercadopago = None


def _access_token(db: Session) -> str | None:
    config = db.get(models.ClubConfig, "club")
    return (config.mpAccessToken if config else None) or MERCADO_PAGO_ACCESS_TOKEN


def webhook_secret(db: Session) -> str | None:
    config = db.get(models.ClubConfig, "club")
    return (config.mpWebhookSecret if config else None) or MERCADO_PAGO_WEBHOOK_SECRET


def _sdk(db: Session):
    token = _access_token(db)
    if not mercadopago or not token:
        raise RuntimeError("Mercado Pago no está configurado")
    return mercadopago.SDK(token)


def create_preference(
    db: Session,
    fee: models.Fee,
    *,
    unit_price: Decimal,
    back_urls: dict[str, str],
    notification_url: str,
) -> dict[str, Any]:
    body = {
        "items": [
            {
                "id": fee.id,
                "title": f"{fee.feeType.name} - {fee.period}",
                "description": f"Cuota {fee.period}",
                "quantity": 1,
                "unit_price": float(unit_price),
                "currency_id": "ARS",
            }
        ],
        "payer": {
            "name": fee.member.firstName,
            "surname": fee.member.lastName,
            **({"email": fee.member.email} if fee.member.email else {}),
        },
        "external_reference": fee.id,
        "back_urls": back_urls,
        "auto_return": "approved",
        "notification_url": notification_url,
    }

    result = _sdk(db).preference().create(body)
    response = result.get("response", {})
    return {
        "preferenceId": response.get("id"),
        "initPoint": response.get("init_point"),
        "sandboxInitPoint": response.get("sandbox_init_point"),
    }


def get_payment(db: Session, payment_id: str) -> dict[str, Any]:
    result = _sdk(db).payment().get(payment_id)
    return result.get("response", {})


def admin_back_urls() -> dict[str, str]:
    base = FRONTEND_URL or ""
    return {
        "success": f"{base}/admin/cuotas/?status=success",
        "failure": f"{base}/admin/cuotas/?status=failure",
        "pending": f"{base}/admin/cuotas/?status=pending",
    }


def member_back_urls() -> dict[str, str]:
    base = FRONTEND_URL or ""
    return {
        "success": f"{base}/member/payment/success",
        "failure": f"{base}/member/payment/failure",
        "pending": f"{base}/member/payment/pending",
    }


def map_mp_status(mp_status: str | None) -> str:
    if mp_status == "approved":
        return "COMPLETED"
    if mp_status in ("pending", "in_process", "authorized"):
        return "PENDING"
    if mp_status in ("rejected", "cancelled", "refunded", "charged_back"):
        return "FAILED"
    return "PENDING"


def update_fee_status(db: Session, fee_id: str) -> None:
    fee = db.scalar(select(models.Fee).where(models.Fee.id == fee_id))
    if not fee:
        return

    total_paid = sum(
        (p.amount for p in fee.payments if p.status == "COMPLETED"),
        Decimal("0"),
    )

    status = "PENDING"
    if total_paid >= fee.amount:
        status = "PAID"
    elif total_paid > 0:
        status = "PARTIALLY_PAID"

    fee.paidAmount = total_paid
    fee.status = status
