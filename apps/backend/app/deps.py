"""Dependencias FastAPI: autenticación de staff (JWT con rol) y de socios."""
from dataclasses import dataclass
from typing import Annotated, Any

import jwt as pyjwt
from fastapi import Depends, Request
from sqlalchemy.orm import Session

from . import models
from .database import get_db
from .errors import forbidden, unauthorized
from .security import verify_token

DbDep = Annotated[Session, Depends(get_db)]

ROLES = ("ADMIN", "OPERATOR", "TEACHER", "STAFF")


def get_club_config(db: Session) -> models.ClubConfig:
    """Devuelve la fila única de configuración (la crea si no existe)."""
    config = db.get(models.ClubConfig, "club")
    if not config:
        config = models.ClubConfig(id="club")
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def _extract_bearer(request: Request) -> str | None:
    auth = request.headers.get("authorization") or ""
    parts = auth.split(" ")
    if len(parts) == 2 and parts[0] == "Bearer":
        return parts[1]
    return None


def get_jwt_payload(request: Request) -> dict[str, Any]:
    token = _extract_bearer(request)
    if not token:
        raise unauthorized()
    try:
        return verify_token(token)
    except pyjwt.PyJWTError:
        raise unauthorized()


JwtPayloadDep = Annotated[dict[str, Any], Depends(get_jwt_payload)]


@dataclass
class StaffContext:
    user: dict[str, Any]
    role: str


def get_staff_context(payload: JwtPayloadDep) -> StaffContext:
    role = payload.get("role")
    if payload.get("scope") == "member" or not role:
        raise forbidden("Usuario no autenticado.")
    return StaffContext(user=payload, role=role)


StaffDep = Annotated[StaffContext, Depends(get_staff_context)]


def require_roles(*roles: str):
    def checker(ctx: StaffDep) -> StaffContext:
        if roles and ctx.role not in roles:
            raise forbidden("No tenés permisos para realizar esta acción.")
        return ctx

    return checker


@dataclass
class MemberContext:
    member_id: str


def get_member_context(request: Request) -> MemberContext:
    token = _extract_bearer(request)
    if not token:
        raise unauthorized("Token no proporcionado")

    try:
        payload = verify_token(token)
    except pyjwt.PyJWTError:
        raise unauthorized("Token inválido o expirado")

    if payload.get("scope") != "member":
        raise unauthorized("Token inválido")

    return MemberContext(member_id=payload["memberId"])


MemberDep = Annotated[MemberContext, Depends(get_member_context)]
