from datetime import datetime, timedelta

from fastapi import APIRouter, Request
from sqlalchemy import select

from .. import models, mp, serializers
from ..config import API_PUBLIC_URL, QR_EXPIRES_MINUTES, QR_SECRET
from ..deps import DbDep, MemberDep
from ..errors import not_found, unauthorized
from ..schemas import LoginMemberDto
from ..security import sign_token
from ..utils import parse_date

router = APIRouter(prefix="/api/member-portal", tags=["member-portal"])


def _notification_url(request: Request) -> str:
    if API_PUBLIC_URL:
        return API_PUBLIC_URL
    base = str(request.base_url).rstrip("/")
    return f"{base}/api/payments/mercado-pago/webhook"


@router.post("/login", status_code=201)
def login(dto: LoginMemberDto, db: DbDep):
    birth = parse_date(dto.birthDate)
    start = datetime(birth.year, birth.month, birth.day)
    end = start + timedelta(days=1) - timedelta(milliseconds=1)

    member = db.scalar(
        select(models.Member).where(
            models.Member.dni == dto.dni,
            models.Member.birthDate >= start,
            models.Member.birthDate <= end,
            models.Member.status == "ACTIVE",
        )
    )
    if not member:
        raise unauthorized("Credenciales inválidas")

    payload = {"sub": member.id, "memberId": member.id, "scope": "member"}

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
