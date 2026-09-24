from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from .. import clock, models, serializers
from ..deps import DbDep, StaffContext, require_roles
from .fees import FEE_LOAD_OPTIONS
from .members import MEMBER_LOAD_OPTIONS
from ..utils import parse_date

router = APIRouter(prefix="/api/reports", tags=["reports"])

Roles = Depends(require_roles("ADMIN", "OPERATOR"))

# Los movimientos anulados quedan en la base pero no suman en ningún total
ACTIVE_TX = models.Transaction.status == "ACTIVE"


def _money(value) -> str:
    """Montos como string decimal (mismo contrato que el resto de la API)."""
    return serializers.dec(value or Decimal("0"))


def _sum_transactions(db, type_: str, frm: date, until: date) -> Decimal:
    """Suma de movimientos activos de un tipo con fecha en [frm, until)."""
    return db.scalar(
        select(func.sum(models.Transaction.amount)).where(
            ACTIVE_TX,
            models.Transaction.type == type_,
            models.Transaction.date >= frm,
            models.Transaction.date < until,
        )
    ) or Decimal("0")


def _sum_payments(db, frm_day: date, until_day: date) -> Decimal:
    """Pagos completados entre dos días locales del club [frm, until)."""
    start, _ = clock.day_bounds_utc(frm_day)
    end, _ = clock.day_bounds_utc(until_day)
    return db.scalar(
        select(func.sum(models.Payment.amount)).where(
            models.Payment.status == "COMPLETED",
            models.Payment.paidAt >= start,
            models.Payment.paidAt < end,
        )
    ) or Decimal("0")


@router.get("/dashboard")
def dashboard(db: DbDep, ctx: StaffContext = Roles):
    # Mes corriente en la zona horaria del club (ver clock.py)
    today = clock.local_today()
    first_day, next_month = clock.month_bounds(today.year, today.month)
    period = f"{today.year}-{today.month:02d}"

    active_members = db.scalar(
        select(func.count()).select_from(models.Member).where(models.Member.status == "ACTIVE")
    )
    total_members = db.scalar(select(func.count()).select_from(models.Member))
    fees_this_month = db.scalar(
        select(func.count()).select_from(models.Fee).where(models.Fee.period == period)
    )
    collected = _sum_payments(db, first_day, next_month)
    income = _sum_transactions(db, "INCOME", first_day, next_month)
    expense = _sum_transactions(db, "EXPENSE", first_day, next_month)

    return {
        "period": period,
        "activeMembers": active_members,
        "totalMembers": total_members,
        "feesThisMonth": fees_this_month,
        "collectedThisMonth": _money(collected),
        "incomeThisMonth": _money(income),
        "expenseThisMonth": _money(expense),
        "balanceThisMonth": _money(collected + income - expense),
    }


@router.get("/members")
def members_report(
    db: DbDep,
    ctx: StaffContext = Roles,
    status: str | None = None,
    disciplineId: str | None = None,
    categoryId: str | None = None,
):
    query = select(models.Member)
    if status:
        query = query.where(models.Member.status == status)

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

    items = db.scalars(
        query.options(*MEMBER_LOAD_OPTIONS).order_by(models.Member.lastName.asc())
    ).all()
    return {
        "items": [serializers.member_full(m) for m in items],
        "total": len(items),
    }


@router.get("/fees")
def fees_report(
    db: DbDep,
    ctx: StaffContext = Roles,
    period: str | None = None,
    status: str | None = None,
):
    query = select(models.Fee)
    if period:
        query = query.where(models.Fee.period == period)
    if status:
        query = query.where(models.Fee.status == status)

    items = db.scalars(
        query.options(*FEE_LOAD_OPTIONS).order_by(models.Fee.createdAt.desc())
    ).all()

    sub = query.subquery()
    sums = db.execute(
        select(func.sum(sub.c.monto), func.sum(sub.c.monto_pagado))
    ).one()
    total_amount = sums[0] or Decimal("0")
    total_paid = sums[1] or Decimal("0")

    return {
        "items": [serializers.fee_list_item(f) for f in items],
        "total": len(items),
        "summary": {
            "totalAmount": _money(total_amount),
            "totalPaid": _money(total_paid),
            "totalPending": _money(total_amount - total_paid),
        },
    }


@router.get("/income-expense")
def income_expense(
    db: DbDep,
    ctx: StaffContext = Roles,
    frm: str | None = Query(default=None, alias="from"),
    to: str | None = None,
):
    query = select(models.Transaction).where(ACTIVE_TX)
    if frm:
        query = query.where(models.Transaction.date >= parse_date(frm))
    if to:
        query = query.where(models.Transaction.date <= parse_date(to))

    items = db.scalars(query.order_by(models.Transaction.date.desc())).all()

    income = sum((t.amount for t in items if t.type == "INCOME"), Decimal("0"))
    expense = sum((t.amount for t in items if t.type == "EXPENSE"), Decimal("0"))

    return {
        "items": [serializers.transaction(t) for t in items],
        "summary": {
            "income": _money(income),
            "expense": _money(expense),
            "balance": _money(income - expense),
        },
    }


@router.get("/cash-closure")
def cash_closure(db: DbDep, date_str: str = Query(alias="date"), ctx: StaffContext = Roles):
    """Cierre de caja de un día local del club (los pagos se filtran por su hora UTC)."""
    day: date = parse_date(date_str)
    next_day = day + timedelta(days=1)

    tx_income = _sum_transactions(db, "INCOME", day, next_day)
    tx_expense = _sum_transactions(db, "EXPENSE", day, next_day)
    payments_income = _sum_payments(db, day, next_day)

    total_income = tx_income + payments_income
    total_expense = tx_expense

    return {
        "date": day.isoformat(),
        "transactionsIncome": _money(tx_income),
        "transactionsExpense": _money(tx_expense),
        "paymentsIncome": _money(payments_income),
        "totalIncome": _money(total_income),
        "totalExpense": _money(total_expense),
        "balance": _money(total_income - total_expense),
    }
