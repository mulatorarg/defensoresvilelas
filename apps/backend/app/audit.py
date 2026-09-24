"""Registro de auditoría: quién hizo qué sobre dinero y datos sensibles."""
import json
from typing import Any

from sqlalchemy.orm import Session

from . import models
from .ids import new_id


def audit(
    db: Session,
    ctx: Any,
    action: str,
    entity: str,
    entity_id: str | None,
    detail: Any = None,
) -> None:
    """Agrega un registro a la sesión (se guarda con el commit de la operación).

    `ctx` es el StaffContext del request; `detail`, cualquier dato serializable.
    """
    user = getattr(ctx, "user", None) or {}
    db.add(models.AuditLog(
        id=new_id(),
        userId=user.get("sub"),
        userEmail=user.get("email"),
        action=action,
        entity=entity,
        entityId=entity_id,
        detail=json.dumps(detail, default=str, ensure_ascii=False) if detail is not None else None,
    ))
