from datetime import datetime, timedelta

from fastapi import APIRouter, Request
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from .. import models, mp, serializers
from ..config import (
    API_PUBLIC_URL,
    PIN_LOCK_MINUTES,
    PIN_MAX_ATTEMPTS,
    QR_EXPIRES_MINUTES,
    QR_SECRET,
)
from ..deps import DbDep, MemberDep, get_club_config
from ..errors import bad_request, not_found, too_many_requests, unauthorized
from ..models import utcnow
from ..schemas import ChangePinDto, LoginMemberDto
from ..security import hash_password, sign_token, verify_password
from ..utils import parse_date

router = APIRouter(prefix="/api/member-portal", tags=["member-portal"])


def _notification_url(request: Request) -> str:
    if API_PUBLIC_URL:
        return API_PUBLIC_URL
    base = str(request.base_url).rstrip("/")
    return f"{base}/api/payments/mercado-pago/webhook"


def _check_pin(db, member: models.Member, pin: str | None, *, fail=unauthorized) -> None:
    """Valida el PIN con bloqueo temporal tras PIN_MAX_ATTEMPTS fallos seguidos."""
    now = utcnow()
    if member.pinLockedUntil and member.pinLockedUntil > now:
        raise too_many_requests(
            f"Demasiados intentos. Probá de nuevo en {PIN_LOCK_MINUTES} minutos "
            "o pedí en secretaría que blanqueen tu PIN."
        )

    if pin and verify_password(pin, member.pinHash):
        member.pinFailedAttempts = 0
        member.pinLockedUntil = None
        return

    member.pinFailedAttempts = (member.pinFailedAttempts or 0) + 1
    if member.pinFailedAttempts >= PIN_MAX_ATTEMPTS:
        member.pinFailedAttempts = 0
        member.pinLockedUntil = now + timedelta(minutes=PIN_LOCK_MINUTES)
    db.commit()
    raise fail("Credenciales inválidas")


def _member_session(member: models.Member) -> dict:
    payload = {
        "sub": member.id,
        "memberId": member.id,
        "scope": "member",
        "tv": member.tokenVersion or 0,
    }
    return {
        "accessToken": sign_token(payload),
        "member": {
            "id": member.id,
            "memberNumber": member.memberNumber,
            "firstName": member.firstName,
            "lastName": member.lastName,
            "dni": member.dni,
        },
    }


@router.post("/login", status_code=201)
def login(dto: LoginMemberDto, db: DbDep):
    """DNI + fecha de nacimiento + PIN.

    Si el socio todavía no tiene PIN, responde `{"pinSetupRequired": true}` sin
    token; el frontend pide el PIN nuevo y repite el login con `newPin`.
    """
    birth = parse_date(dto.birthDate)
    start = datetime(birth.year, birth.month, birth.day)
    end = start + timedelta(days=1) - timedelta(milliseconds=1)

    member = db.scalar(
        select(models.Member).where(
            models.Member.dni == dto.dni.strip(),
            models.Member.birthDate >= start,
            models.Member.birthDate <= end,
            models.Member.status == "ACTIVE",
        )
    )
    if not member:
        raise unauthorized("Credenciales inválidas")

    if member.pinHash:
        _check_pin(db, member, dto.pin)
    elif dto.newPin:
        member.pinHash = hash_password(dto.newPin)
        member.pinFailedAttempts = 0
        member.pinLockedUntil = None
    else:
        return {"pinSetupRequired": True}

    db.commit()
    return _member_session(member)


@router.post("/me/pin")
def change_pin(dto: ChangePinDto, ctx: MemberDep, db: DbDep):
    """Cambia el PIN propio y cierra las otras sesiones del socio."""
    member = db.get(models.Member, ctx.member_id)
    if not member.pinHash:
        raise bad_request("Todavía no definiste un PIN")
    # 400 y no 401: el frontend trata el 401 como sesión vencida
    _check_pin(db, member, dto.currentPin, fail=lambda _msg: bad_request("El PIN actual no es correcto"))

    member.pinHash = hash_password(dto.newPin)
    member.tokenVersion = (member.tokenVersion or 0) + 1
    db.commit()
    return _member_session(member)


@router.get("/me")
def get_profile(ctx: MemberDep, db: DbDep):
    member = db.scalar(
        select(models.Member).where(
            models.Member.id == ctx.member_id,
            models.Member.status == "ACTIVE",
        )
    )
    if not member:
        raise not_found("Socio no encontrado")
    return serializers.member_full(member)


@router.get("/me/fees")
def get_fees(ctx: MemberDep, db: DbDep):
    fees = db.scalars(
        select(models.Fee)
        .where(
            models.Fee.memberId == ctx.member_id,
            models.Fee.status.in_(["PENDING", "PARTIALLY_PAID"]),
        )
        .order_by(models.Fee.period.asc(), models.Fee.dueDate.asc())
    ).all()

    result = []
    for f in fees:
        data = serializers.fee_base(f)
        data["feeType"] = (
            {"id": f.feeType.id, "name": f.feeType.name} if f.feeType else None
        )
        data["category"] = (
            {
                "id": f.category.id,
                "name": f.category.name,
                "discipline": serializers.discipline_ref(f.category.discipline),
            }
            if f.category
            else None
        )
        data["payments"] = [
            {"id": p.id, "amount": serializers.dec(p.amount), "paidAt": serializers.iso(p.paidAt)}
            for p in f.payments
            if p.status == "COMPLETED"
        ]
        result.append(data)
    return result


@router.post("/me/fees/{fee_id}/mp-preference", status_code=201)
def create_preference(fee_id: str, request: Request, ctx: MemberDep, db: DbDep):
    fee = db.scalar(
        select(models.Fee).where(
            models.Fee.id == fee_id,
            models.Fee.memberId == ctx.member_id,
            models.Fee.status.in_(["PENDING", "PARTIALLY_PAID"]),
        )
    )
    if not fee:
        raise not_found("Cuota no encontrada o ya pagada")

    result = mp.create_preference(
        db,
        fee,
        unit_price=fee.amount - (fee.paidAmount or 0),
        back_urls=mp.member_back_urls(),
        notification_url=_notification_url(request),
    )

    fee.externalReference = result["preferenceId"]
    db.commit()
    return result


@router.get("/me/payments")
def get_payments(ctx: MemberDep, db: DbDep):
    """Últimos pagos acreditados del socio (con acceso a su recibo)."""
    payments = db.scalars(
        select(models.Payment)
        .where(models.Payment.memberId == ctx.member_id, models.Payment.status == "COMPLETED")
        .options(selectinload(models.Payment.fee).selectinload(models.Fee.feeType))
        .order_by(models.Payment.paidAt.desc())
        .limit(24)
    ).all()
    return [
        {
            **serializers.payment(p),
            "receiptNumber": p.id[-8:].upper(),
            "period": p.fee.period if p.fee else None,
            "concept": p.fee.feeType.name if p.fee and p.fee.feeType else "Cuota",
        }
        for p in payments
    ]


@router.get("/me/payments/{payment_id}")
def get_payment_receipt(payment_id: str, ctx: MemberDep, db: DbDep):
    """Recibo de un pago propio (un socio no puede ver pagos de otro)."""
    pay = db.get(models.Payment, payment_id)
    if not pay or pay.memberId != ctx.member_id or pay.status != "COMPLETED":
        raise not_found("Pago no encontrado")
    return serializers.payment_receipt(pay, get_club_config(db))


@router.get("/me/card")
def get_card(ctx: MemberDep, db: DbDep):
    member = db.get(models.Member, ctx.member_id)
    config = db.get(models.ClubConfig, "club")

    if not member:
        raise not_found("Socio no encontrado")

    qr_payload = sign_token(
        {"sub": member.id, "memberId": member.id, "scope": "member-qr"},
        secret=QR_SECRET,
        expires_delta=timedelta(minutes=QR_EXPIRES_MINUTES),
    )

    return {
        "member": {
            "id": member.id,
            "memberNumber": member.memberNumber,
            "firstName": member.firstName,
            "lastName": member.lastName,
            "dni": member.dni,
            "photoUrl": member.photoUrl,
        },
        "qrPayload": qr_payload,
        "club": {
            "name": config.name if config else "Club",
            "logoUrl": config.logoUrl if config else None,
            "primaryColor": config.primaryColor if config else None,
        },
    }
