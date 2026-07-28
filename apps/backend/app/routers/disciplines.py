from fastapi import APIRouter, Depends
from sqlalchemy import select

from .. import models, serializers
from ..deps import DbDep, StaffContext, require_roles
from ..errors import not_found
from ..ids import new_id
from ..schemas import CreateDisciplineDto, UpdateDisciplineDto

router = APIRouter(prefix="/api/disciplines", tags=["disciplines"])

ReadRoles = Depends(require_roles("ADMIN", "OPERATOR", "TEACHER", "STAFF"))
WriteRoles = Depends(require_roles("ADMIN", "OPERATOR"))


def _sorted_categories(d: models.Discipline) -> list[models.Category]:
    return sorted(d.categories, key=lambda c: c.name)


def _get_discipline(db, discipline_id: str) -> models.Discipline:
    discipline = db.get(models.Discipline, discipline_id)
    if not discipline:
        raise not_found("Disciplina no encontrada")
    return discipline


@router.post("", status_code=201)
def create(dto: CreateDisciplineDto, db: DbDep, ctx: StaffContext = WriteRoles):
    discipline = models.Discipline(
        id=new_id(),
        name=dto.name,
        description=dto.description,
        icon=dto.icon,
        isActive=dto.isActive if dto.isActive is not None else True,
    )
    db.add(discipline)
    db.commit()
    db.refresh(discipline)
    return serializers.discipline_full(discipline, _sorted_categories(discipline))


@router.get("")
def find_all(db: DbDep, ctx: StaffContext = ReadRoles):
    disciplines = db.scalars(
        select(models.Discipline).order_by(models.Discipline.name.asc())
    ).all()
    return [serializers.discipline_full(d, _sorted_categories(d)) for d in disciplines]


@router.get("/{discipline_id}")
def find_one(discipline_id: str, db: DbDep, ctx: StaffContext = ReadRoles):
    discipline = _get_discipline(db, discipline_id)
    return serializers.discipline_full(discipline, _sorted_categories(discipline))


@router.patch("/{discipline_id}")
def update(discipline_id: str, dto: UpdateDisciplineDto, db: DbDep, ctx: StaffContext = WriteRoles):
    discipline = _get_discipline(db, discipline_id)
    for key, value in dto.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(discipline, key, value)
    db.commit()
    db.refresh(discipline)
    return serializers.discipline_full(discipline, _sorted_categories(discipline))


@router.delete("/{discipline_id}")
def remove(discipline_id: str, db: DbDep, ctx: StaffContext = WriteRoles):
    discipline = _get_discipline(db, discipline_id)
    discipline.isActive = False
    db.commit()
    db.refresh(discipline)
    return serializers.discipline_full(discipline, _sorted_categories(discipline))
