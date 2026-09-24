from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from .. import clock, models, serializers
from ..audit import audit
from ..deps import DbDep, StaffContext, require_roles
from ..errors import bad_request, not_found
from ..ids import new_id
from ..models import utcnow
from ..schemas import CreateTransactionDto, VoidTransactionDto
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
        date=parse_date(dto.date) if dto.date else clock.local_today(),
        status="ACTIVE",
        createdBy=ctx.user.get("sub"),
    )
    db.add(transaction)
    audit(db, ctx, "CREATE", "transaction", transaction.id, serializers.transaction(transaction))
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
    includeVoided: bool = True,
):
    query = select(models.Transaction)
    if type:
        query = query.where(models.Transaction.type == type)
    if frm:
        query = query.where(models.Transaction.date >= parse_date(frm))
    if to:
        query = query.where(models.Transaction.date <= parse_date(to))
    if not includeVoided:
        query = query.where(models.Transaction.status == "ACTIVE")

    items = db.scalars(
        query.order_by(models.Transaction.date.desc(), models.Transaction.createdAt.desc())
    ).all()
    return [serializers.transaction(t) for t in items]


@router.post("/{transaction_id}/void")
def void(transaction_id: str, dto: VoidTransactionDto, db: DbDep, ctx: StaffContext = Roles):
    """Anula un movimiento: deja de sumar en caja y reportes, pero queda registrado."""
    transaction = db.get(models.Transaction, transaction_id)
    if not transaction:
        raise not_found("Movimiento no encontrado")
    if transaction.status == "VOIDED":
        raise bad_request("El movimiento ya está anulado")

    transaction.status = "VOIDED"
    transaction.voidedAt = utcnow()
    transaction.voidedBy = ctx.user.get("sub")
    transaction.voidReason = dto.reason.strip()
    audit(db, ctx, "VOID", "transaction", transaction.id, {
        **serializers.transaction(transaction),
    })
    db.commit()
    db.refresh(transaction)
    return serializers.transaction(transaction)
