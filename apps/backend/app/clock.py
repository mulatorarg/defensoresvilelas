"""Fechas en la zona horaria del club.

Criterio de toda la app:
- En la base todo se guarda en UTC naive (models.utcnow). La sesión de MariaDB
  se fija en UTC (database.py) y el contenedor corre con TZ=UTC, así el
  resultado no depende de cómo esté configurado el VPS ni el servidor de base.
- Los cortes que ve el usuario (hoy, el mes corriente, el cierre de caja de un
  día, el período de una cuota) se calculan en CLUB_TIMEZONE (.env, default
  America/Argentina/Buenos_Aires). Es una constante del proceso: no hay
  consulta a la base para saber la zona.
- El frontend muestra todo en esa misma zona (lib/dates.ts).
"""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from . import models
from .config import CLUB_TIMEZONE

CLUB_TZ = ZoneInfo(CLUB_TIMEZONE)


def to_utc_naive(local: datetime) -> datetime:
    return local.astimezone(timezone.utc).replace(tzinfo=None)


def local_now() -> datetime:
    return datetime.now(CLUB_TZ)


def local_today() -> date:
    return local_now().date()


def current_period() -> str:
    today = local_today()
    return f"{today.year}-{today.month:02d}"


def day_bounds_utc(day: date) -> tuple[datetime, datetime]:
    """[inicio, fin) del día local, en UTC naive (para filtrar columnas DateTime)."""
    start = datetime.combine(day, time.min, tzinfo=CLUB_TZ)
    end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=CLUB_TZ)
    return to_utc_naive(start), to_utc_naive(end)


def month_bounds(year: int, month: int) -> tuple[date, date]:
    """[primer día, primer día del mes siguiente) como fechas locales."""
    first = date(year, month, 1)
    following = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    return first, following


def local_date_to_utc(day: date) -> datetime:
    """Momento en UTC para algo registrado "en tal fecha" sin hora.

    Si es hoy, se usa la hora actual; si es otro día, el mediodía local
    (queda dentro de ese día local para el cierre de caja y los reportes).
    """
    if day == local_today():
        return models.utcnow()
    return to_utc_naive(datetime.combine(day, time(12, 0), tzinfo=CLUB_TZ))


def parse_local_datetime(value: str) -> datetime:
    """Fecha y hora cargada por el usuario, a UTC naive.

    Sin zona ("2026-10-05T18:00", como manda <input type="datetime-local">) es
    hora del club; con zona ("...Z", "...-03:00") se respeta la indicada.
    """
    from .errors import bad_request

    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        raise bad_request(f"Fecha inválida: {value}")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=CLUB_TZ)
    return to_utc_naive(dt)
