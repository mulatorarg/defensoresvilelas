from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select

from .. import models, serializers
from ..deps import DbDep, StaffContext, require_roles
from ..errors import conflict, not_found
from ..ids import new_id
from ..schemas import CreateMemberDto, UpdateMemberDto
from ..utils import parse_datetime

router = APIRouter(prefix="/api/members", tags=["members"])

ReadRoles = Depends(require_roles("ADMIN", "OPERATOR", "TEACHER", "STAFF"))
WriteRoles = Depends(require_roles("ADMIN", "OPERATOR"))


def _get_member(db, member_id: str) -> models.Member:
    member = db.get(models.Member, member_id)
    if not member:
        raise not_found("Socio no encontrado")
    return member


def _ensure_dni_available(db, dni: str) -> None:
    exists = db.scalar(select(models.Member.id).where(models.Member.dni == dni))
    if exists:
        raise conflict("Ya existe un socio con ese DNI")


def _apply_player_profile(member: models.Member, dto) -> None:
    profile = member.player
    if profile is None:
        profile = models.PlayerProfile(id=new_id(), memberId=member.id)
        member.player = profile
    profile.position = dto.position
    profile.jerseyNumber = dto.jerseyNumber
    profile.federationId = dto.federationId
    profile.medicalPassDue = (
        parse_datetime(dto.medicalPassDue) if dto.medicalPassDue else None
    )
    profile.notes = dto.notes


@router.post("", status_code=201)
def create(dto: CreateMemberDto, db: DbDep, ctx: StaffContext = WriteRoles):
    _ensure_dni_available(db, dto.dni)

    count = db.scalar(select(func.count()).select_from(models.Member))

    member = models.Member(
        id=new_id(),
        firstName=dto.firstName,
        lastName=dto.lastName,
        dni=dto.dni,
        email=dto.email,
        phone=dto.phone,
        address=dto.address,
        birthDate=parse_datetime(dto.birthDate) if dto.birthDate else None,
        photoUrl=dto.photoUrl,
        status=dto.status or "ACTIVE",
        notes=dto.notes,
        memberNumber=str(count + 1).zfill(5),
    )
    db.add(member)

    if dto.playerProfile:
        _apply_player_profile(member, dto.playerProfile)

    db.commit()
    db.refresh(member)
    return serializers.member_full(member)


@router.get("")
def find_all(
    db: DbDep,
    ctx: StaffContext = ReadRoles,
    search: str | None = None,
    status: str | None = None,
    categoryId: str | None = None,
    disciplineId: str | None = None,
    page: str | None = None,
    limit: str | None = None,
):
    page_n = max(1, int(page or "1"))
    limit_n = min(100, max(1, int(limit or "20")))

    query = select(models.Member)

    if status:
        query = query.where(models.Member.status == status)

    if search:
        term = "%" + search.strip() + "%"
        query = query.where(
            or_(
                models.Member.firstName.like(term),
                models.Member.lastName.like(term),
                models.Member.dni.like(term),
                models.Member.email.like(term),
            )
        )

    if categoryId:
        query = query.where(
            models.Member.enrollments.any(
                (models.Enrollment.categoryId == categoryId)
                & (models.Enrollment.status == "ACTIVE")
            )
        )
    elif disciplineId:
        query = query.where(
            models.Member.enrollments.any(
                models.Enrollment.category.has(
                    models.Category.disciplineId == disciplineId
                )
                & (models.Enrollment.status == "ACTIVE")
            )
        )

    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(
        query.order_by(models.Member.lastName.asc())
        .offset((page_n - 1) * limit_n)
        .limit(limit_n)
    ).all()

    total_pages = (total + limit_n - 1) // limit_n if total else 0
    return {
        "items": [serializers.member_full(m) for m in items],
        "meta": {"page": page_n, "limit": limit_n, "total": total, "totalPages": total_pages},
    }


@router.get("/{member_id}")
def find_one(member_id: str, db: DbDep, ctx: StaffContext = ReadRoles):
    return serializers.member_full(_get_member(db, member_id))


@router.patch("/{member_id}")
def update(member_id: str, dto: UpdateMemberDto, db: DbDep, ctx: StaffContext = WriteRoles):
    member = _get_member(db, member_id)

    if dto.dni and dto.dni != member.dni:
        _ensure_dni_available(db, dto.dni)

    fields = dto.model_dump(exclude_unset=True, exclude={"playerProfile", "birthDate"})
    for key, value in fields.items():
        if value is not None:
            setattr(member, key, value)

    if dto.birthDate:
        member.birthDate = parse_datetime(dto.birthDate)

    if dto.playerProfile:
        _apply_player_profile(member, dto.playerProfile)

    db.commit()
    db.refresh(member)
    return serializers.member_full(member)


@router.delete("/{member_id}")
def remove(member_id: str, db: DbDep, ctx: StaffContext = WriteRoles):
    member = _get_member(db, member_id)
    # Baja lógica; los pagos quedan asociados al historial.
    member.status = "INACTIVE"
    db.commit()
    db.refresh(member)
    return serializers.member_full(member)
