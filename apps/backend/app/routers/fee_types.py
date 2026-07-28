from fastapi import APIRouter, Depends
from sqlalchemy import select

from .. import models, serializers
from ..deps import DbDep, StaffContext, require_roles
from ..errors import not_found
from ..ids import new_id
from ..schemas import CreateFeeTypeDto, UpdateFeeTypeDto

router = APIRouter(prefix="/api/fee-types", tags=["fee-types"])

Roles = Depends(require_roles("ADMIN", "OPERATOR"))


def _get_fee_type(db, fee_type_id: str) -> models.FeeType:
    fee_type = db.get(models.FeeType, fee_type_id)
    if not fee_type:
        raise not_found("Tipo de cuota no encontrado")
    return fee_type


@router.post("", status_code=201)
def create(dto: CreateFeeTypeDto, db: DbDep, ctx: StaffContext = Roles):
    fee_type = models.FeeType(
        id=new_id(),
        name=dto.name,
        description=dto.description,
        isActive=dto.isActive if dto.isActive is not None else True,
    )
    db.add(fee_type)
    db.commit()
    db.refresh(fee_type)
    return serializers.fee_type(fee_type)


@router.get("")
def find_all(db: DbDep, ctx: StaffContext = Roles):
    fee_types = db.scalars(
        select(models.FeeType).order_by(models.FeeType.name.asc())
    ).all()
    return [serializers.fee_type(ft) for ft in fee_types]


@router.get("/{fee_type_id}")
def find_one(fee_type_id: str, db: DbDep, ctx: StaffContext = Roles):
    return serializers.fee_type(_get_fee_type(db, fee_type_id))


@router.patch("/{fee_type_id}")
def update(fee_type_id: str, dto: UpdateFeeTypeDto, db: DbDep, ctx: StaffContext = Roles):
    fee_type = _get_fee_type(db, fee_type_id)
    for key, value in dto.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(fee_type, key, value)
    db.commit()
    db.refresh(fee_type)
    return serializers.fee_type(fee_type)


@router.delete("/{fee_type_id}")
def remove(fee_type_id: str, db: DbDep, ctx: StaffContext = Roles):
    fee_type = _get_fee_type(db, fee_type_id)
    fee_type.isActive = False
    db.commit()
    db.refresh(fee_type)
    return serializers.fee_type(fee_type)
