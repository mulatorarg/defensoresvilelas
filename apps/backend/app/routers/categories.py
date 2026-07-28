from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select

from .. import models, serializers
from ..deps import DbDep, StaffContext, require_roles
from ..errors import not_found
from ..ids import new_id
from ..schemas import CreateCategoryDto, UpdateCategoryDto

router = APIRouter(prefix="/api/categories", tags=["categories"])

ReadRoles = Depends(require_roles("ADMIN", "OPERATOR", "TEACHER", "STAFF"))
WriteRoles = Depends(require_roles("ADMIN", "OPERATOR"))


def _get_category(db, category_id: str) -> models.Category:
    category = db.get(models.Category, category_id)
    if not category:
        raise not_found("Categoría no encontrada")
    return category


def _ensure_discipline(db, discipline_id: str) -> None:
    if not db.get(models.Discipline, discipline_id):
        raise not_found("Disciplina no encontrada")


@router.post("", status_code=201)
def create(dto: CreateCategoryDto, db: DbDep, ctx: StaffContext = WriteRoles):
    _ensure_discipline(db, dto.disciplineId)

    category = models.Category(
        id=new_id(),
        disciplineId=dto.disciplineId,
        name=dto.name,
        ageFrom=dto.ageFrom,
        ageTo=dto.ageTo,
        gender=dto.gender or "MIXED",
        feeAmount=Decimal(dto.feeAmount) if dto.feeAmount else None,
        schedule=dto.schedule,
        isActive=dto.isActive if dto.isActive is not None else True,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return serializers.category_with_discipline(category)


@router.get("")
def find_all(db: DbDep, ctx: StaffContext = ReadRoles, disciplineId: str | None = None):
    query = select(models.Category)
    if disciplineId:
        query = query.where(models.Category.disciplineId == disciplineId)
    categories = db.scalars(query.order_by(models.Category.name.asc())).all()
    return [serializers.category_with_discipline(c) for c in categories]


@router.get("/{category_id}")
def find_one(category_id: str, db: DbDep, ctx: StaffContext = ReadRoles):
    category = _get_category(db, category_id)
    data = serializers.category_with_discipline(category)
    data["enrollments"] = [
        {
            "id": e.id,
            "memberId": e.memberId,
            "categoryId": e.categoryId,
            "enrolledAt": serializers.iso(e.enrolledAt),
            "leftAt": serializers.iso(e.leftAt),
            "status": e.status,
            "member": serializers.member_ref(e.member, with_dni=True),
        }
        for e in category.enrollments
        if e.status == "ACTIVE"
    ]
    return data


@router.patch("/{category_id}")
def update(category_id: str, dto: UpdateCategoryDto, db: DbDep, ctx: StaffContext = WriteRoles):
    category = _get_category(db, category_id)

    if dto.disciplineId and dto.disciplineId != category.disciplineId:
        _ensure_discipline(db, dto.disciplineId)

    fields = dto.model_dump(exclude_unset=True, exclude={"feeAmount"})
    for key, value in fields.items():
        if value is not None:
            setattr(category, key, value)

    if dto.feeAmount:
        category.feeAmount = Decimal(dto.feeAmount)

    db.commit()
    db.refresh(category)
    return serializers.category_with_discipline(category)


@router.delete("/{category_id}")
def remove(category_id: str, db: DbDep, ctx: StaffContext = WriteRoles):
    category = _get_category(db, category_id)
    category.isActive = False
    db.commit()
    db.refresh(category)
    return serializers.category_with_discipline(category)
