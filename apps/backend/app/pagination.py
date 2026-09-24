"""Paginación uniforme: {"items": [...], "meta": {page, limit, total, totalPages}}."""
from typing import Any, Callable

from sqlalchemy import func, select
from sqlalchemy.orm import Session


def paginate(
    db: Session,
    query,
    page: int,
    limit: int,
    serialize: Callable[[Any], dict],
    *,
    max_limit: int = 100,
    options: tuple = (),
    order_by: tuple = (),
) -> dict:
    page_n = max(1, page)
    limit_n = min(max_limit, max(1, limit))
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    items = db.scalars(
        query.options(*options)
        .order_by(*order_by)
        .offset((page_n - 1) * limit_n)
        .limit(limit_n)
    ).all()
    return {
        "items": [serialize(i) for i in items],
        "meta": {
            "page": page_n,
            "limit": limit_n,
            "total": total,
            "totalPages": (total + limit_n - 1) // limit_n if total else 0,
        },
    }
