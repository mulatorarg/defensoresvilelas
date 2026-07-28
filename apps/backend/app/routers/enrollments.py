from fastapi import APIRouter, Depends
from sqlalchemy import select

from .. import models, serializers
from ..deps import DbDep, StaffContext, require_roles
from ..errors import conflict
from ..ids import new_id
from ..models import utcnow
from ..schemas import CreateEnrollmentDto
from ..utils import parse_datetime

router = APIRouter(prefix="/api/enrollments", tags=["enrollments"])

Roles = Depends(require_roles("ADMIN", "OPERATOR", "TEACHER"))


@router.post("", status_code=201)
def create(dto: CreateEnrollmentDto, db: DbDep, ctx: StaffContext = Roles):
    member = db.get(models.Member, dto.memberId)
    category = db.get(models.Category, dto.categoryId)

    if not member:
        raise conflict("Socio no encontrado")
    if not category:
        raise conflict("Categoría no encontrada")

    existing = db.scalar(
        select(models.Enrollment).where(
            models.Enrollment.memberId == dto.memberId,
            models.Enrollment.categoryId == dto.categoryId,
            models.Enrollment.status == "ACTIVE",
        )
    )
    if existing:
        raise conflict(
            f"El socio ya está inscripto en {category.discipline.name} - {category.name}"
        )

    enrollment = models.Enrollment(
        id=new_id(),
        memberId=dto.memberId,
        categoryId=dto.categoryId,
        enrolledAt=parse_datetime(dto.enrolledAt) if dto.enrolledAt else utcnow(),
        status="ACTIVE",
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return serializers.enrollment_full(enrollment)


@router.delete("/{enrollment_id}")
def remove(enrollment_id: str, db: DbDep, ctx: StaffContext = Roles):
    enrollment = db.scalar(
        select(models.Enrollment).where(
            models.Enrollment.id == enrollment_id,
            models.Enrollment.status == "ACTIVE",
        )
    )
    if not enrollment:
        raise conflict("Inscripción no encontrada")

    enrollment.status = "INACTIVE"
    enrollment.leftAt = utcnow()
    db.commit()
    db.refresh(enrollment)
    return serializers.enrollment_full(enrollment)
