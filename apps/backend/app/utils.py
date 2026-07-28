"""Utilidades de parseo de fechas (equivalente a new Date(str) en JS)."""
from datetime import date, datetime

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
        dt = dt.astimezone(tz=None).replace(tzinfo=None)
    return dt


def parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value.strip()[:10])
    except ValueError:
        raise bad_request(f"Fecha inválida: {value}")
