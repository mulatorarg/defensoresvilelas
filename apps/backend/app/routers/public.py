"""Endpoints públicos de la landing del club (sin JWT)."""
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from .. import models, mp, serializers
from ..deps import DbDep, get_club_config
from ..errors import bad_request, conflict, not_found
from ..ids import new_id
from ..models import utcnow
from ..utils import parse_date

router = APIRouter(prefix="/api/public", tags=["public"])


class RegisterMemberDto(BaseModel):
    firstName: str = Field(min_length=1)
    lastName: str = Field(min_length=1)
    dni: str = Field(min_length=6)
    birthDate: str = Field(min_length=8)  # YYYY-MM-DD
    email: str | None = None
    phone: str | None = None
    categoryId: str | None = None


@router.post("/register", status_code=201)
def register(dto: RegisterMemberDto, db: DbDep):
    """Alta de socio desde la landing, con primera cuota paga (pago simulado)."""
    exists = db.scalar(select(models.Member.id).where(models.Member.dni == dto.dni.strip()))
    if exists:
        raise conflict(
            "Ya existe un socio con ese DNI. Si sos vos, ingresá al portal del socio."
        )

    category = None
    if dto.categoryId:
        category = db.get(models.Category, dto.categoryId)
        if not category or not category.isActive:
            raise not_found("Categoría no encontrada")

    config = get_club_config(db)
    amount = (
        category.feeAmount
        if category and category.feeAmount
        else (config.monthlyFee or Decimal("0"))
    )
    if amount <= 0:
        raise bad_request(
            "El club todavía no tiene configurado el valor de la cuota. Acercate a secretaría."
        )

    birth = parse_date(dto.birthDate)
    count = db.scalar(select(func.count()).select_from(models.Member))

    member = models.Member(
        id=new_id(),
        firstName=dto.firstName.strip(),
        lastName=dto.lastName.strip(),
        dni=dto.dni.strip(),
        email=dto.email,
        phone=dto.phone,
        birthDate=datetime(birth.year, birth.month, birth.day),
        status="ACTIVE",
        memberNumber=str(count + 1).zfill(5),
        notes="Alta online desde la web",
    )
    db.add(member)
    db.flush()

    if category:
        db.add(models.Enrollment(
            id=new_id(), memberId=member.id, categoryId=category.id, status="ACTIVE",
        ))

    # Tipo de cuota "Cuota social" (se crea si no existe)
    fee_type = db.scalar(
        select(models.FeeType).where(models.FeeType.name == "Cuota social")
    )
    if not fee_type:
        fee_type = models.FeeType(id=new_id(), name="Cuota social")
        db.add(fee_type)
        db.flush()

    now = utcnow()
    period = f"{now.year}-{now.month:02d}"
    fee = models.Fee(
        id=new_id(),
        memberId=member.id,
        feeTypeId=fee_type.id,
        categoryId=category.id if category else None,
        period=period,
        amount=amount,
        paidAmount=Decimal("0"),
        status="PENDING",
    )
    db.add(fee)
    db.flush()

    # Pago simulado (checkout online de prueba; Mercado Pago vendrá después)
    db.add(models.Payment(
        id=new_id(),
        memberId=member.id,
        feeId=fee.id,
        amount=amount,
        method="TRANSFER",
        status="COMPLETED",
        reference="simulacion-web",
        paidAt=now,
    ))
    db.flush()
    mp.update_fee_status(db, fee.id)
    db.commit()
    db.refresh(member)
    db.refresh(fee)

    return {
        "member": {
            "id": member.id,
            "memberNumber": member.memberNumber,
            "firstName": member.firstName,
            "lastName": member.lastName,
            "dni": member.dni,
        },
        "fee": {
            "period": fee.period,
            "amount": serializers.dec(fee.amount),
            "status": fee.status,
        },
        "category": (
            {"id": category.id, "name": category.name} if category else None
        ),
        "message": "¡Bienvenido al club! Ya podés ingresar al portal del socio con tu DNI y fecha de nacimiento.",
    }


@router.get("/disciplines")
def disciplines(db: DbDep):
    items = db.scalars(
        select(models.Discipline)
        .where(models.Discipline.isActive.is_(True))
        .order_by(models.Discipline.name.asc())
    ).all()

    return [
        {
            "id": d.id,
            "name": d.name,
            "description": d.description,
            "icon": d.icon,
            "categories": [
                {
                    "id": c.id,
                    "name": c.name,
                    "ageFrom": c.ageFrom,
                    "ageTo": c.ageTo,
                    "gender": c.gender,
                    "schedule": c.schedule,
                }
                for c in sorted(d.categories, key=lambda c: c.name)
                if c.isActive
            ],
        }
        for d in items
    ]


@router.get("/news")
def news(db: DbDep, limit: int = 6):
    items = db.scalars(
        select(models.News)
        .where(models.News.published.is_(True))
        .order_by(models.News.publishedAt.desc())
        .limit(min(20, max(1, limit)))
    ).all()

    return [
        {
            "id": n.id,
            "title": n.title,
            "slug": n.slug,
            "excerpt": n.excerpt,
            "imageUrl": n.imageUrl,
            "publishedAt": serializers.iso(n.publishedAt),
        }
        for n in items
    ]


@router.get("/events")
def events(db: DbDep, limit: int = 6):
    items = db.scalars(
        select(models.Event)
        .where(
            models.Event.isPublic.is_(True),
            models.Event.eventDate >= utcnow(),
        )
        .order_by(models.Event.eventDate.asc())
        .limit(min(20, max(1, limit)))
    ).all()

    return [
        {
            "id": e.id,
            "title": e.title,
            "description": e.description,
            "eventDate": serializers.iso(e.eventDate),
            "location": e.location,
        }
        for e in items
    ]


@router.get("/matches")
def matches(db: DbDep, limit: int = 6):
    items = db.scalars(
        select(models.Match)
        .order_by(models.Match.matchDate.desc())
        .limit(min(20, max(1, limit)))
    ).all()

    return [
        {
            "id": m.id,
            "matchDate": serializers.iso(m.matchDate),
            "location": m.location,
            "status": m.status,
            "homeTeam": m.homeTeam.name,
            "awayTeam": m.awayTeam.name,
            "homeScore": m.homeScore,
            "awayScore": m.awayScore,
        }
        for m in items
    ]
