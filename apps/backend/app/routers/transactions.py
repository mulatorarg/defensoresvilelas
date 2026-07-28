from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from .. import models, serializers
from ..deps import DbDep, StaffContext, require_roles
from ..errors import not_found
from ..ids import new_id
from ..models import utcnow
from ..schemas import CreateTransactionDto
from ..utils import parse_date

router = APIRouter(prefix="/api/transactions", tags=["transactions"])

Roles = Depends(require_roles("ADMIN", "OPERATOR"))


@router.post("", status_code=201)
def create(dto: CreateTransactionDto, db: DbDep, ctx: StaffContext = Roles):
    transaction = models.Transaction(
        id=new_id(),
        type=dto.type,
        category=dto.category,
        amount=Decimal(dto.amount),
        description=dto.description,
        date=parse_date(dto.date) if dto.date else utcnow().date(),
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return serializers.transaction(transaction)


@router.get("")
def find_all(
    db: DbDep,
    ctx: StaffContext = Roles,
    type: str | None = None,
    frm: str | None = Query(default=None, alias="from"),
    to: str | None = None,
):
    query = select(models.Transaction)
    if type:
        query = query.where(models.Transaction.type == type)
    if frm:
        query = query.where(models.Transaction.date >= parse_date(frm))
    if to:
        query = query.where(models.Transaction.date <= parse_date(to))

    items = db.scalars(query.order_by(models.Transaction.date.desc())).all()
    return [serializers.transaction(t) for t in items]


@router.delete("/{transaction_id}")
def remove(transaction_id: str, db: DbDep, ctx: StaffContext = Roles):
    transaction = db.get(models.Transaction, transaction_id)
    if not transaction:
        raise not_found("Transacción no encontrada")

    data = serializers.transaction(transaction)
    db.delete(transaction)
    db.commit()
    return data
