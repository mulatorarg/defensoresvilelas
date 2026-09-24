"""Configuración del club: pública para la landing, editable por el admin."""
from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from .. import crypto, serializers
from ..audit import audit
from ..schemas import OptionalAmount, OptionalEmail
from ..deps import DbDep, StaffContext, get_club_config, require_roles

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
    email: OptionalEmail = None
    whatsapp: str | None = None
    instagram: str | None = None
    facebook: str | None = None
    website: str | None = None
    monthlyFee: OptionalAmount = None
    mpAccessToken: str | None = Field(default=None, max_length=500)
    mpWebhookSecret: str | None = Field(default=None, max_length=500)


@router.get("")
def get_public(db: DbDep):
    return serializers.club_public(get_club_config(db))


@router.get("/config")
def get_config(db: DbDep, _=Depends(require_roles("ADMIN"))):
    return serializers.club_config_full(get_club_config(db))


@router.patch("/config")
def update_config(
    dto: UpdateClubConfigDto, db: DbDep, ctx: StaffContext = Depends(require_roles("ADMIN"))
):
    config = get_club_config(db)
    fields = dto.model_dump(exclude_unset=True)
    if "monthlyFee" in fields:
        raw = fields.pop("monthlyFee")
        config.monthlyFee = Decimal(raw) if raw else None
    for key in ("mpAccessToken", "mpWebhookSecret"):
        if key not in fields:
            continue
        raw = (fields.pop(key) or "").strip()
        # El GET devuelve el valor enmascarado: si vuelve igual, no se toca
        if crypto.is_masked(raw):
            continue
        setattr(config, key, crypto.encrypt(raw or None))
    for key, value in fields.items():
        setattr(config, key, value)
    audit(db, ctx, "UPDATE", "club_config", config.id, sorted(dto.model_fields_set))
    db.commit()
    db.refresh(config)
    return serializers.club_config_full(config)
