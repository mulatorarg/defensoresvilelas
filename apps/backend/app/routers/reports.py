from datetime import date, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from .. import models, serializers
from ..deps import DbDep, StaffContext, require_roles
from ..utils import parse_date, parse_datetime

router = APIRouter(prefix="/api/reports", tags=["reports"])

Roles = Depends(require_roles("ADMIN", "OPERATOR"))


def _num(value) -> float:
    return float(value or 0)


@router.get("/dashboard")
def dashboard(db: DbDep, ctx: StaffContext = Roles):
    now = datetime.now()
    first_day = datetime(now.year, now.month, 1)
    if now.month == 12:
        last_day = datetime(now.year, 12, 31, 23, 59, 59)
    else:
        last_day = datetime(now.year, now.month + 1, 1) - timedelta(seconds=1)

    period = f"{now.year}-{now.month:02d}"

    active_members = db.scalar(
        select(func.count()).select_from(models.Member).where(models.Member.status == "ACTIVE")
    )
    total_members = db.scalar(select(func.count()).select_from(models.Member))
    fees_this_month = db.scalar(
        select(func.count()).select_from(models.Fee).where(models.Fee.period == period)
    )
    collected = db.scalar(
        select(func.sum(models.Payment.amount)).where(
            models.Payment.status == "COMPLETED",
            models.Payment.paidAt >= first_day,
            models.Payment.paidAt <= last_day,
        )
    )
    income = db.scalar(
        select(func.sum(models.Transaction.amount)).where(
            models.Transaction.type == "INCOME",
            models.Transaction.date >= first_day.date(),
            models.Transaction.date <= last_day.date(),
        )
    )
    expense = db.scalar(
        select(func.sum(models.Transaction.amount)).where(
            models.Transaction.type == "EXPENSE",
            models.Transaction.date >= first_day.date(),
            models.Transaction.date <= last_day.date(),
        )
    )

    return {
        "activeMembers": active_members,
        "totalMembers": total_members,
        "feesThisMonth": fees_this_month,
        "collectedThisMonth": _num(collected),
        "incomeThisMonth": _num(income),
        "expenseThisMonth": _num(expense),
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

    items = db.scalars(query.order_by(models.Member.lastName.asc())).all()
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

    items = db.scalars(query.order_by(models.Fee.createdAt.desc())).all()

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
            "totalAmount": float(total_amount),
            "totalPaid": float(total_paid),
            "totalPending": float(total_amount - total_paid),
        },
    }


@router.get("/income-expense")
def income_expense(
    db: DbDep,
    ctx: StaffContext = Roles,
    frm: str | None = Query(default=None, alias="from"),
    to: str | None = None,
):
    query = select(models.Transaction)
    if frm:
        query = query.where(models.Transaction.date >= parse_datetime(frm).date())
    if to:
        query = query.where(models.Transaction.date <= parse_datetime(to).date())

    items = db.scalars(query.order_by(models.Transaction.date.desc())).all()

    income = sum((t.amount for t in items if t.type == "INCOME"), Decimal("0"))
    expense = sum((t.amount for t in items if t.type == "EXPENSE"), Decimal("0"))

    return {
        "items": [serializers.transaction(t) for t in items],
        "summary": {
            "income": float(income),
            "expense": float(expense),
            "balance": float(income - expense),
        },
    }


@router.get("/cash-closure")
def cash_closure(db: DbDep, date_str: str = Query(alias="date"), ctx: StaffContext = Roles):
    day: date = parse_date(date_str)
    next_day = day + timedelta(days=1)

    tx_income = db.scalar(
        select(func.sum(models.Transaction.amount)).where(
            models.Transaction.type == "INCOME",
            models.Transaction.date >= day,
            models.Transaction.date < next_day,
        )
    ) or Decimal("0")
    tx_expense = db.scalar(
        select(func.sum(models.Transaction.amount)).where(
            models.Transaction.type == "EXPENSE",
            models.Transaction.date >= day,
            models.Transaction.date < next_day,
        )
    ) or Decimal("0")
    payments_income = db.scalar(
        select(func.sum(models.Payment.amount)).where(
            models.Payment.status == "COMPLETED",
            models.Payment.paidAt >= datetime(day.year, day.month, day.day),
            models.Payment.paidAt < datetime(next_day.year, next_day.month, next_day.day),
        )
    ) or Decimal("0")

    total_income = tx_income + payments_income
    total_expense = tx_expense

    return {
        "transactionsIncome": float(tx_income),
        "transactionsExpense": float(tx_expense),
        "paymentsIncome": float(payments_income),
        "totalIncome": float(total_income),
        "totalExpense": float(total_expense),
        "balance": float(total_income - total_expense),
    }
