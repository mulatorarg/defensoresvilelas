import jwt as pyjwt
from fastapi import APIRouter, Depends
from sqlalchemy import select

from .. import models, serializers
from ..config import QR_SECRET
from ..deps import DbDep, StaffContext, require_roles
from ..errors import not_found, unauthorized
from ..routers.attendances import upsert_attendance
from ..schemas import RegisterAttendanceDto, ScanMemberDto
from ..security import verify_token
from ..utils import parse_date

router = APIRouter(prefix="/api/staff-portal", tags=["staff-portal"])

Roles = Depends(require_roles("ADMIN", "OPERATOR", "TEACHER", "STAFF"))


def _find_active_member(db, member_id: str) -> models.Member:
    member = db.scalar(
        select(models.Member).where(
            models.Member.id == member_id,
            models.Member.status == "ACTIVE",
        )
    )
    if not member:
        raise not_found("Socio no encontrado o inactivo")
    return member


@router.post("/scan", status_code=201)
def scan_member(dto: ScanMemberDto, db: DbDep, ctx: StaffContext = Roles):
    try:
        payload = verify_token(dto.qrPayload, secret=QR_SECRET)
    except pyjwt.PyJWTError:
        raise unauthorized("QR inválido o expirado")

    if payload.get("scope") != "member-qr":
        raise unauthorized("QR inválido")

    member = _find_active_member(db, payload["memberId"])
    return serializers.member_full(member)


@router.get("/members/{member_id}")
def find_member(member_id: str, db: DbDep, ctx: StaffContext = Roles):
    return serializers.member_full(_find_active_member(db, member_id))


@router.post("/attendance", status_code=201)
def register_attendance(dto: RegisterAttendanceDto, db: DbDep, ctx: StaffContext = Roles):
    if not db.get(models.Category, dto.categoryId):
        raise not_found("Categoría no encontrada")

    _find_active_member(db, dto.memberId)

    enrollment = db.scalar(
        select(models.Enrollment.id).where(
            models.Enrollment.memberId == dto.memberId,
            models.Enrollment.categoryId == dto.categoryId,
            models.Enrollment.status == "ACTIVE",
        )
    )
    if not enrollment:
        raise not_found("El socio no está inscripto en esta categoría")

    attendance = upsert_attendance(
        db, dto.categoryId, dto.memberId, parse_date(dto.date), True, dto.notes
    )
    db.commit()
    db.refresh(attendance)
    return serializers.attendance_full(attendance)
