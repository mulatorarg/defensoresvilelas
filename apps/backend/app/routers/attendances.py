from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, serializers
from ..deps import DbDep, StaffContext, require_roles
from ..errors import not_found
from ..ids import new_id
from ..schemas import BulkAttendanceDto, CreateAttendanceDto
from ..utils import parse_date

router = APIRouter(prefix="/api/attendances", tags=["attendances"])

Roles = Depends(require_roles("ADMIN", "OPERATOR", "TEACHER", "STAFF"))


def validate_category(db: Session, category_id: str) -> None:
    if not db.get(models.Category, category_id):
        raise not_found("Categoría no encontrada")


def validate_member_enrollment(db: Session, category_id: str, member_id: str) -> None:
    member = db.scalar(
        select(models.Member.id).where(
            models.Member.id == member_id, models.Member.status == "ACTIVE"
        )
    )
    if not member:
        raise not_found("Socio no encontrado o inactivo")

    enrollment = db.scalar(
        select(models.Enrollment.id).where(
            models.Enrollment.memberId == member_id,
            models.Enrollment.categoryId == category_id,
            models.Enrollment.status == "ACTIVE",
        )
    )
    if not enrollment:
        raise not_found("El socio no está inscripto en esta categoría")


def upsert_attendance(
    db: Session,
    category_id: str,
    member_id: str,
    day: date,
    present: bool,
    notes: str | None,
) -> models.Attendance:
    attendance = db.scalar(
        select(models.Attendance).where(
            models.Attendance.categoryId == category_id,
            models.Attendance.memberId == member_id,
            models.Attendance.date == day,
        )
    )
    if attendance:
        attendance.present = present
        attendance.notes = notes
    else:
        attendance = models.Attendance(
            id=new_id(),
            categoryId=category_id,
            memberId=member_id,
            date=day,
            present=present,
            notes=notes,
        )
        db.add(attendance)
    return attendance


@router.post("", status_code=201)
def create(dto: CreateAttendanceDto, db: DbDep, ctx: StaffContext = Roles):
    validate_category(db, dto.categoryId)
    validate_member_enrollment(db, dto.categoryId, dto.memberId)

    attendance = upsert_attendance(
        db,
        dto.categoryId,
        dto.memberId,
        parse_date(dto.date),
        dto.present if dto.present is not None else True,
        dto.notes,
    )
    db.commit()
    db.refresh(attendance)
    return serializers.attendance_full(attendance)


@router.post("/bulk", status_code=201)
def bulk_create(dto: BulkAttendanceDto, db: DbDep, ctx: StaffContext = Roles):
    validate_category(db, dto.categoryId)
    day = parse_date(dto.date)

    for record in dto.records:
        upsert_attendance(db, dto.categoryId, record.memberId, day, record.present, record.notes)
    db.commit()

    return find_all(db=db, ctx=ctx, categoryId=dto.categoryId, date=dto.date)


@router.get("")
def find_all(
    db: DbDep,
    ctx: StaffContext = Roles,
    categoryId: str | None = None,
    memberId: str | None = None,
    date: str | None = None,
):
    query = select(models.Attendance)
    if categoryId:
        query = query.where(models.Attendance.categoryId == categoryId)
    if memberId:
        query = query.where(models.Attendance.memberId == memberId)
    if date:
        query = query.where(models.Attendance.date == parse_date(date))

    items = db.scalars(
        query.join(models.Attendance.member).order_by(
            models.Attendance.date.desc(), models.Member.lastName.asc()
        )
    ).all()
    return [serializers.attendance_full(a) for a in items]


@router.delete("/{attendance_id}")
def remove(attendance_id: str, db: DbDep, ctx: StaffContext = Roles):
    attendance = db.get(models.Attendance, attendance_id)
    if not attendance:
        raise not_found("Asistencia no encontrada")

    data = {
        "id": attendance.id,
        "categoryId": attendance.categoryId,
        "memberId": attendance.memberId,
        "date": serializers.iso_date(attendance.date),
        "present": attendance.present,
        "notes": attendance.notes,
        "createdBy": attendance.createdBy,
        "createdAt": serializers.iso(attendance.createdAt),
    }
    db.delete(attendance)
    db.commit()
    return data
