"""Configuración del club: pública para la landing, editable por el admin."""
from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from .. import serializers
from ..deps import DbDep, get_club_config, require_roles

router = APIRouter(prefix="/api/club", tags=["club"])


class UpdateClubConfigDto(BaseModel):
    name: str | None = None
    legalName: str | None = None
    document: str | None = None
    logoUrl: str | None = None
    primaryColor: str | None = None
    secondaryColor: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    whatsapp: str | None = None
    instagram: str | None = None
    facebook: str | None = None
    website: str | None = None
    monthlyFee: str | None = None
    mpAccessToken: str | None = None
    mpWebhookSecret: str | None = None


@router.get("")
def get_public(db: DbDep):
    return serializers.club_public(get_club_config(db))


@router.get("/config")
def get_config(db: DbDep, _=Depends(require_roles("ADMIN"))):
    return serializers.club_config_full(get_club_config(db))


@router.patch("/config")
def update_config(dto: UpdateClubConfigDto, db: DbDep, _=Depends(require_roles("ADMIN"))):
    config = get_club_config(db)
    fields = dto.model_dump(exclude_unset=True)
    if "monthlyFee" in fields:
        raw = fields.pop("monthlyFee")
        config.monthlyFee = Decimal(raw) if raw else None
    for key, value in fields.items():
        setattr(config, key, value)
    db.commit()
    db.refresh(config)
    return serializers.club_config_full(config)
