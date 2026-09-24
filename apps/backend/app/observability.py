"""Logging con request-id y reporte de errores a Sentry (opcional).

- Cada request lleva un id (se respeta el X-Request-ID que mande Nginx o el
  cliente, si no se genera uno) que vuelve en el header de la respuesta y
  aparece en todas las líneas de log de ese request.
- Con SENTRY_DSN definido, los errores no manejados se reportan a Sentry (o a
  GlitchTip, que usa el mismo protocolo). Sin la variable no hace nada.
"""
import logging
import time
import uuid
from contextvars import ContextVar

from fastapi import Request

from .config import APP_ENV, LOG_LEVEL, SENTRY_DSN, SENTRY_TRACES_SAMPLE_RATE

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

logger = logging.getLogger("clubes")


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


def setup_logging() -> None:
    handler = logging.StreamHandler()
    handler.addFilter(_RequestIdFilter())
    handler.setFormatter(logging.Formatter(
        "%(asctime)s %(levelname)s %(name)s [req=%(request_id)s] %(message)s"
    ))
    root = logging.getLogger()
    # Idempotente: con --reload o varios imports no se duplican los handlers
    root.handlers = [h for h in root.handlers if not getattr(h, "_clubes", False)]
    handler._clubes = True  # type: ignore[attr-defined]
    root.addHandler(handler)
    root.setLevel(LOG_LEVEL)


def setup_sentry() -> None:
    if not SENTRY_DSN:
        return
    import sentry_sdk

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=APP_ENV,
        traces_sample_rate=SENTRY_TRACES_SAMPLE_RATE,
        send_default_pii=False,
    )
    logger.info("Sentry habilitado (entorno %s)", APP_ENV)


async def request_context(request: Request, call_next):
    """Middleware: asigna el request-id y registra las requests a la API."""
    incoming = request.headers.get("x-request-id", "")
    request_id = incoming[:64] if incoming else uuid.uuid4().hex[:16]
    token = request_id_var.set(request_id)
    start = time.perf_counter()
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        response.headers["X-Request-ID"] = request_id
        return response
    except Exception:
        logger.exception("Error no manejado en %s %s", request.method, request.url.path)
        raise
    finally:
        if request.url.path.startswith("/api/"):
            elapsed = (time.perf_counter() - start) * 1000
            logger.info("%s %s -> %s (%.0f ms)", request.method, request.url.path, status, elapsed)
        request_id_var.reset(token)
