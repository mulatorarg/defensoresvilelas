from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select

from .. import models, serializers
from ..deps import DbDep, StaffContext, require_roles
from ..errors import bad_request, not_found
from ..ids import new_id
from ..schemas import GenerateFeesDto
from ..utils import parse_datetime

router = APIRouter(prefix="/api/fees", tags=["fees"])

Roles = Depends(require_roles("ADMIN", "OPERATOR"))


def _target_member_ids(db, dto: GenerateFeesDto) -> list[str]:
    if dto.memberIds:
        rows = db.scalars(
            select(models.Member.id).where(
                models.Member.id.in_(dto.memberIds),
                models.Member.status == "ACTIVE",
            )
        ).all()
        return list(rows)

    if dto.categoryId:
        rows = db.scalars(
            select(models.Member.id)
            .join(models.Enrollment, models.Enrollment.memberId == models.Member.id)
            .where(
                models.Enrollment.categoryId == dto.categoryId,
                models.Enrollment.status == "ACTIVE",
                models.Member.status == "ACTIVE",
            )
        ).all()
        return list(rows)

    rows = db.scalars(
        select(models.Member.id).where(models.Member.status == "ACTIVE")
    ).all()
    return list(rows)


@router.post("/generate", status_code=201)
def generate(dto: GenerateFeesDto, db: DbDep, ctx: StaffContext = Roles):
    fee_type = db.get(models.FeeType, dto.feeTypeId)
    if not fee_type:
        raise not_found("Tipo de cuota no encontrado")

    category = None
    if dto.categoryId:
        category = db.get(models.Category, dto.categoryId)
        if not category:
            raise not_found("Categoría no encontrada")

    member_ids = _target_member_ids(db, dto)
    if not member_ids:
        return {"created": 0}

    amount = (
        Decimal(dto.amount)
        if dto.amount
        else (category.feeAmount if category and category.feeAmount else Decimal("0"))
    )
    if amount == 0:
        raise bad_request(
            "Debe indicar un monto o la categoría debe tener cuota definida"
        )

    existing_query = select(models.Fee.memberId).where(
        models.Fee.period == dto.period,
        models.Fee.feeTypeId == dto.feeTypeId,
        models.Fee.memberId.in_(member_ids),
    )
    if category:
        existing_query = existing_query.where(models.Fee.categoryId == category.id)

    existing_member_ids = set(db.scalars(existing_query).all())
    members_to_create = [m for m in member_ids if m not in existing_member_ids]

    if not members_to_create:
        return {"created": 0, "skipped": len(member_ids)}

    due_date = parse_datetime(dto.dueDate) if dto.dueDate else None
    for member_id in members_to_create:
        db.add(
            models.Fee(
                id=new_id(),
                memberId=member_id,
                feeTypeId=dto.feeTypeId,
                categoryId=category.id if category else None,
                period=dto.period,
                amount=amount,
                paidAmount=Decimal("0"),
                dueDate=due_date,
                status="PENDING",
            )
        )
    db.commit()

    return {"created": len(members_to_create), "skipped": len(existing_member_ids)}


@router.get("")
def find_all(
    db: DbDep,
    ctx: StaffContext = Roles,
    memberId: str | None = None,
    status: str | None = None,
    period: str | None = None,
    categoryId: str | None = None,
    page: str | None = None,
    limit: str | None = None,
):
    page_n = max(1, int(page or "1"))
    limit_n = min(100, max(1, int(limit or "20")))

    query = select(models.Fee)
    if memberId:
        query = query.where(models.Fee.memberId == memberId)
    if status:
        query = query.where(models.Fee.status == status)
    if period:
        query = query.where(models.Fee.period == period)
    if categoryId:
        query = query.where(models.Fee.categoryId == categoryId)

    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(
        query.order_by(models.Fee.createdAt.desc())
        .offset((page_n - 1) * limit_n)
        .limit(limit_n)
    ).all()

    total_pages = (total + limit_n - 1) // limit_n if total else 0
    return {
        "items": [serializers.fee_list_item(f) for f in items],
        "meta": {"page": page_n, "limit": limit_n, "total": total, "totalPages": total_pages},
    }


@router.get("/{fee_id}")
def find_one(fee_id: str, db: DbDep, ctx: StaffContext = Roles):
    fee = db.get(models.Fee, fee_id)
    if not fee:
        raise not_found("Cuota no encontrada")
    return serializers.fee_detail(fee)
