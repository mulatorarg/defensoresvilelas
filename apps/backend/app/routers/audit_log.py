"""Consulta del registro de auditoría (solo ADMIN)."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from .. import models, serializers
from ..deps import DbDep, require_roles

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("")
def find_all(
    db: DbDep,
    _=Depends(require_roles("ADMIN")),
    entity: str | None = None,
    entityId: str | None = None,
    userId: str | None = None,
    action: str | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
):
    query = select(models.AuditLog)
    if entity:
        query = query.where(models.AuditLog.entity == entity)
    if entityId:
        query = query.where(models.AuditLog.entityId == entityId)
    if userId:
        query = query.where(models.AuditLog.userId == userId)
    if action:
        query = query.where(models.AuditLog.action == action)

    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(
        query.order_by(models.AuditLog.createdAt.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    ).all()

    return {
        "items": [
            {
                "id": a.id,
                "userId": a.userId,
                "userEmail": a.userEmail,
                "action": a.action,
                "entity": a.entity,
                "entityId": a.entityId,
                "detail": serializers.parse_json(a.detail),
                "createdAt": serializers.iso(a.createdAt),
            }
            for a in items
        ],
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": max(1, -(-total // limit)),
        },
    }
