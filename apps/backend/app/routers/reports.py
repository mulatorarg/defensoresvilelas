from datetime import date, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import selectinload

from .. import clock, models, serializers
from ..csv_export import csv_response
from ..deps import DbDep, StaffContext, require_roles
from ..errors import bad_request
from ..pagination import paginate
from .fees import FEE_LOAD_OPTIONS
from .members import MEMBER_LOAD_OPTIONS
from ..utils import parse_date

router = APIRouter(prefix="/api/reports", tags=["reports"])

Roles = Depends(require_roles("ADMIN", "OPERATOR"))

# Los movimientos anulados quedan en la base pero no suman en ningún total
ACTIVE_TX = models.Transaction.status == "ACTIVE"


MEMBER_STATUS = {"ACTIVE": "Activo", "INACTIVE": "Inactivo", "SUSPENDED": "Suspendido"}
FEE_STATUS = {
    "PENDING": "Pendiente", "PARTIALLY_PAID": "Parcial", "PAID": "Pagada", "CANCELLED": "Anulada",
}
PAYMENT_METHOD = {
    "CASH": "Efectivo", "TRANSFER": "Transferencia", "MERCADO_PAGO": "Mercado Pago",
    "DEBIT": "Débito", "CREDIT": "Crédito", "OTHER": "Otro",
}


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
        select(func.count()).select_from(models.Fee).where(
            models.Fee.period == period, models.Fee.status != "CANCELLED"
        )
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


def _members_query(status, disciplineId, categoryId):
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
    return query


MEMBER_ORDER = (models.Member.lastName.asc(), models.Member.firstName.asc())


@router.get("/members")
def members_report(
    db: DbDep,
    ctx: StaffContext = Roles,
    status: str | None = None,
    disciplineId: str | None = None,
    categoryId: str | None = None,
    page: int = 1,
    limit: int = 50,
):
    result = paginate(
        db, _members_query(status, disciplineId, categoryId), page, limit,
        serializers.member_full, max_limit=200,
        options=MEMBER_LOAD_OPTIONS, order_by=MEMBER_ORDER,
    )
    result["total"] = result["meta"]["total"]
    return result


@router.get("/members.csv")
def members_csv(
    db: DbDep,
    ctx: StaffContext = Roles,
    status: str | None = None,
    disciplineId: str | None = None,
    categoryId: str | None = None,
):
    members = db.scalars(
        _members_query(status, disciplineId, categoryId)
        .options(*MEMBER_LOAD_OPTIONS)
        .order_by(*MEMBER_ORDER)
    ).all()

    def rows():
        for m in members:
            activities = ", ".join(
                f"{e.category.discipline.name} {e.category.name}"
                for e in m.enrollments if e.status == "ACTIVE"
            )
            yield [
                m.memberNumber, m.lastName, m.firstName, m.dni, m.email, m.phone,
                m.birthDate.date() if m.birthDate else None,
                MEMBER_STATUS.get(m.status, m.status), activities, m.createdAt,
            ]

    return csv_response(
        f"socios-{clock.local_today().isoformat()}.csv",
        ["Nº socio", "Apellido", "Nombre", "DNI", "Email", "Teléfono", "Nacimiento",
         "Estado", "Actividades", "Alta"],
        rows(),
    )


def _fees_query(period, status):
    query = select(models.Fee)
    if period:
        query = query.where(models.Fee.period == period)
    if status:
        query = query.where(models.Fee.status == status)
    return query


@router.get("/fees")
def fees_report(
    db: DbDep,
    ctx: StaffContext = Roles,
    period: str | None = None,
    status: str | None = None,
    page: int = 1,
    limit: int = 50,
):
    query = _fees_query(period, status)
    result = paginate(
        db, query, page, limit, serializers.fee_list_item, max_limit=200,
        options=FEE_LOAD_OPTIONS, order_by=(models.Fee.createdAt.desc(),),
    )

    # Totales sobre todo el filtro (no solo la página); las anuladas no suman
    sub = query.where(models.Fee.status != "CANCELLED").subquery()
    sums = db.execute(
        select(func.sum(sub.c.monto), func.sum(sub.c.monto_pagado))
    ).one()
    total_amount = sums[0] or Decimal("0")
    total_paid = sums[1] or Decimal("0")

    result["total"] = result["meta"]["total"]
    result["summary"] = {
        "totalAmount": _money(total_amount),
        "totalPaid": _money(total_paid),
        "totalPending": _money(total_amount - total_paid),
    }
    return result


@router.get("/fees.csv")
def fees_csv(
    db: DbDep,
    ctx: StaffContext = Roles,
    period: str | None = None,
    status: str | None = None,
):
    fees = db.scalars(
        _fees_query(period, status)
        .options(*FEE_LOAD_OPTIONS)
        .order_by(models.Fee.period.desc(), models.Fee.createdAt.desc())
    ).all()

    def rows():
        for f in fees:
            yield [
                f.period, f.member.lastName, f.member.firstName, f.member.dni,
                f.feeType.name if f.feeType else "Cuota",
                f"{f.category.discipline.name} {f.category.name}" if f.category else "",
                f.amount, f.paidAmount or Decimal("0"),
                f.amount - (f.paidAmount or Decimal("0")) if f.status != "CANCELLED" else Decimal("0"),
                FEE_STATUS.get(f.status, f.status),
                f.dueDate.date() if f.dueDate else None,
            ]

    return csv_response(
        f"cuotas{'-' + period if period else ''}-{clock.local_today().isoformat()}.csv",
        ["Período", "Apellido", "Nombre", "DNI", "Concepto", "Categoría", "Monto",
         "Pagado", "Saldo", "Estado", "Vencimiento"],
        rows(),
    )


def _transactions_query(frm: str | None, to: str | None):
    query = select(models.Transaction).where(ACTIVE_TX)
    if frm:
        query = query.where(models.Transaction.date >= parse_date(frm))
    if to:
        query = query.where(models.Transaction.date <= parse_date(to))
    return query


@router.get("/income-expense")
def income_expense(
    db: DbDep,
    ctx: StaffContext = Roles,
    frm: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    page: int = 1,
    limit: int = 50,
):
    query = _transactions_query(frm, to)
    result = paginate(
        db, query, page, limit, serializers.transaction, max_limit=200,
        order_by=(models.Transaction.date.desc(), models.Transaction.createdAt.desc()),
    )

    sub = query.subquery()
    income, expense = db.execute(
        select(
            func.sum(case((sub.c.tipo == "INCOME", sub.c.monto), else_=0)),
            func.sum(case((sub.c.tipo == "EXPENSE", sub.c.monto), else_=0)),
        )
    ).one()
    income = income or Decimal("0")
    expense = expense or Decimal("0")

    result["summary"] = {
        "income": _money(income),
        "expense": _money(expense),
        "balance": _money(income - expense),
    }
    return result


@router.get("/cash.csv")
def cash_csv(
    db: DbDep,
    ctx: StaffContext = Roles,
    frm: str = Query(alias="from"),
    to: str = Query(),
):
    """Movimientos de caja y pagos de cuotas del rango (días locales del club)."""
    first, last = parse_date(frm), parse_date(to)
    if last < first:
        raise bad_request("La fecha 'hasta' es anterior a 'desde'")
    start, _ = clock.day_bounds_utc(first)
    _, end = clock.day_bounds_utc(last)

    transactions = db.scalars(
        _transactions_query(frm, to).order_by(models.Transaction.date, models.Transaction.createdAt)
    ).all()
    payments = db.scalars(
        select(models.Payment)
        .where(
            models.Payment.status == "COMPLETED",
            models.Payment.paidAt >= start,
            models.Payment.paidAt < end,
        )
        .options(
            selectinload(models.Payment.member),
            selectinload(models.Payment.fee).selectinload(models.Fee.feeType),
        )
        .order_by(models.Payment.paidAt)
    ).all()

    def rows():
        for t in transactions:
            signed = t.amount if t.type == "INCOME" else -t.amount
            yield [t.date, "Ingreso" if t.type == "INCOME" else "Egreso", "Caja",
                   t.category, t.description, signed]
        for p in payments:
            member = f"{p.member.lastName}, {p.member.firstName}" if p.member else ""
            concept = p.fee.feeType.name if p.fee and p.fee.feeType else "Cuota"
            period = p.fee.period if p.fee else ""
            yield [p.paidAt, "Ingreso", f"Cuota ({PAYMENT_METHOD.get(p.method, p.method)})",
                   f"{concept} {period}".strip(), member, p.amount]

    return csv_response(
        f"caja-{first.isoformat()}-a-{last.isoformat()}.csv",
        ["Fecha", "Tipo", "Origen", "Concepto", "Detalle", "Monto"],
        rows(),
    )


# ---------------------------------------------------------------- Morosidad


def _delinquent_fees(db):
    """Cuotas impagas vencidas: por fecha de vencimiento o, si no tiene, por período.

    La fecha de vencimiento es una fecha de calendario (se guarda a las 00:00):
    vence el día siguiente a esa fecha en la hora del club.
    """
    today = clock.local_today()
    today_start = datetime(today.year, today.month, today.day)
    return db.scalars(
        select(models.Fee)
        .join(models.Fee.member)
        .where(
            models.Fee.status.in_(["PENDING", "PARTIALLY_PAID"]),
            models.Member.status == "ACTIVE",
            or_(
                models.Fee.dueDate < today_start,
                (models.Fee.dueDate.is_(None)) & (models.Fee.period < clock.current_period()),
            ),
        )
        .options(
            selectinload(models.Fee.member),
            selectinload(models.Fee.feeType),
            selectinload(models.Fee.category).selectinload(models.Category.discipline),
        )
        .order_by(models.Fee.period)
    ).all()


def _group_by_member(fees) -> list[dict]:
    groups: dict[str, dict] = {}
    for f in fees:
        owed = f.amount - (f.paidAmount or Decimal("0"))
        g = groups.setdefault(f.memberId, {
            "member": {
                "id": f.member.id,
                "memberNumber": f.member.memberNumber,
                "firstName": f.member.firstName,
                "lastName": f.member.lastName,
                "dni": f.member.dni,
                "phone": f.member.phone,
                "email": f.member.email,
            },
            "fees": [],
            "total": Decimal("0"),
        })
        g["total"] += owed
        g["fees"].append({
            "id": f.id,
            "period": f.period,
            "concept": f.feeType.name if f.feeType else "Cuota",
            "category": f"{f.category.discipline.name} {f.category.name}" if f.category else None,
            "owed": _money(owed),
            "dueDate": serializers.iso(f.dueDate),
            "status": f.status,
        })
    result = sorted(groups.values(), key=lambda g: g["total"], reverse=True)
    for g in result:
        g["oldestPeriod"] = g["fees"][0]["period"]
        g["feesCount"] = len(g["fees"])
        g["total"] = _money(g["total"])
    return result


@router.get("/delinquency")
def delinquency(db: DbDep, ctx: StaffContext = Roles):
    members = _group_by_member(_delinquent_fees(db))
    total = sum((Decimal(m["total"]) for m in members), Decimal("0"))
    return {
        "items": members,
        "summary": {
            "members": len(members),
            "fees": sum(m["feesCount"] for m in members),
            "total": _money(total),
        },
    }


@router.get("/delinquency.csv")
def delinquency_csv(db: DbDep, ctx: StaffContext = Roles):
    members = _group_by_member(_delinquent_fees(db))

    def rows():
        for m in members:
            member = m["member"]
            yield [member["memberNumber"], member["lastName"], member["firstName"], member["dni"],
                   member["phone"], member["email"], m["feesCount"], m["oldestPeriod"],
                   Decimal(m["total"])]

    return csv_response(
        f"morosidad-{clock.local_today().isoformat()}.csv",
        ["Nº socio", "Apellido", "Nombre", "DNI", "Teléfono", "Email", "Cuotas vencidas",
         "Desde", "Deuda"],
        rows(),
    )


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
