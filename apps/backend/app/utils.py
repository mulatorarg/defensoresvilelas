"""Utilidades de parseo de fechas (equivalente a new Date(str) en JS) y numeración."""
from datetime import date, datetime, timezone

from sqlalchemy import Integer, cast, func, select
from sqlalchemy.orm import Session

from . import models
from .errors import bad_request


def parse_datetime(value: str) -> datetime:
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        raise bad_request(f"Fecha inválida: {value}")
    if dt.tzinfo is not None:
        # En la base todo va en UTC naive (antes convertía a la hora del servidor)
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def is_date_only(value: str) -> bool:
    """"2026-09-23" (sin hora), como manda un <input type="date">."""
    return len(value.strip()) == 10


def parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value.strip()[:10])
    except ValueError:
        raise bad_request(f"Fecha inválida: {value}")


def next_member_number(db: Session) -> str:
    """Próximo número de socio (máximo actual + 1, con ceros a la izquierda).

    Usar el máximo y no count() evita colisiones con el unique de numero_socio
    si alguna vez se borra un socio o se cargan números a mano.
    """
    current = db.scalar(select(func.max(cast(models.Member.memberNumber, Integer))))
    return str((current or 0) + 1).zfill(5)
