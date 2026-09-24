"""Backend Clubes SaaS en Python (FastAPI).

Réplica del contrato de API del backend NestJS: mismas rutas bajo /api,
mismo formato de errores y misma base MariaDB (tablas en español).
"""
from datetime import datetime, timezone
from decimal import InvalidOperation
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .config import ENABLE_DOCS, FRONTEND_DIST_PATH, FRONTEND_URL, RECURSOS_DIR
from .database import engine
from .observability import logger, request_context, setup_logging, setup_sentry
from .routers import (
    attendances,
    audit_log,
    auth,
    categories,
    disciplines,
    enrollments,
    fee_types,
    fees,
    club,
    member_portal,
    members,
    payments,
    public,
    reports,
    staff_portal,
    transactions,
)

setup_logging()
setup_sentry()

app = FastAPI(
    title="Clubes SaaS API",
    docs_url="/api/docs" if ENABLE_DOCS else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if ENABLE_DOCS else None,
)

# En producción la web y la API comparten origen y CORS no hace falta. Solo se
# habilita para el origen de FRONTEND_URL (p. ej. next dev en :3000); sin la
# variable no se permite ningún origen cruzado. La auth va por header Bearer,
# no por cookies: allow_credentials no es necesario.
if FRONTEND_URL:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[FRONTEND_URL.rstrip("/")],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# CSP: Next (export estático) emite scripts y estilos inline, de ahí 'unsafe-inline'.
# Igual limita el daño de un XSS: no se pueden cargar scripts externos, ni enviar
# datos a otros dominios (connect-src/form-action), ni embeber el sitio en iframes.
# img-src admite https: porque logos y fotos pueden ser URLs externas.
CONTENT_SECURITY_POLICY = "; ".join([
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
])


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    headers = response.headers
    headers.setdefault("X-Content-Type-Options", "nosniff")
    headers.setdefault("X-Frame-Options", "DENY")
    headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    headers.setdefault("Permissions-Policy", "camera=(self), microphone=(), geolocation=()")
    # Swagger UI carga JS/CSS de un CDN: sin CSP en la documentación
    if not request.url.path.startswith("/api/docs"):
        headers.setdefault("Content-Security-Policy", CONTENT_SECURITY_POLICY)
    # HSTS solo detrás de HTTPS (Nginx con certbot manda X-Forwarded-Proto)
    if request.headers.get("x-forwarded-proto") == "https" or request.url.scheme == "https":
        headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response


# Registrado después que security_headers: es el middleware más externo, así el
# request-id cubre también las respuestas de los demás
app.middleware("http")(request_context)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    # Los helpers de errors.py ya construyen el formato NestJS; el resto se normaliza
    detail = exc.detail
    if not isinstance(detail, dict):
        detail = {"statusCode": exc.status_code, "message": detail}
    return JSONResponse(status_code=exc.status_code, content=detail)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    # NestJS ValidationPipe responde 400 con un array de mensajes
    messages = [
        f"{'.'.join(str(loc) for loc in err['loc'] if loc != 'body')}: {err['msg']}"
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=400,
        content={"statusCode": 400, "message": messages, "error": "Bad Request"},
    )


@app.exception_handler(InvalidOperation)
async def invalid_decimal_handler(_request: Request, _exc: InvalidOperation):
    # Red de seguridad: un monto no numérico que se escape de la validación
    # de los DTOs responde 400 en lugar de 500.
    return JSONResponse(
        status_code=400,
        content={"statusCode": 400, "message": "Monto inválido", "error": "Bad Request"},
    )


@app.get("/health")
def health():
    """Healthcheck del compose y de monitoreo externo: verifica también la base."""
    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        logger.error("Healthcheck: la base no responde (%s)", exc.__class__.__name__)
        return JSONResponse(
            status_code=503,
            content={"status": "error", "database": "down", "timestamp": timestamp},
        )
    return {"status": "ok", "database": "ok", "timestamp": timestamp}


for module in (
    auth,
    audit_log,
    club,
    members,
    disciplines,
    categories,
    enrollments,
    attendances,
    fee_types,
    fees,
    payments,
    transactions,
    reports,
    member_portal,
    staff_portal,
    public,
):
    app.include_router(module.router)


# --- Recursos del club (fotos de socios, etc.) — volumen persistente ---

_recursos = Path(RECURSOS_DIR)
_recursos.mkdir(parents=True, exist_ok=True)
app.mount("/recursos", StaticFiles(directory=_recursos), name="recursos")


# --- Frontend estático (build de Next.js) con fallback SPA ---

_dist = Path(FRONTEND_DIST_PATH)


@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend(full_path: str):
    if full_path.startswith(("api/", "recursos/")) or full_path in ("api", "recursos"):
        raise HTTPException(status_code=404, detail={"statusCode": 404, "message": "Not Found"})

    index = _dist / "index.html"
    if not index.exists():
        return JSONResponse(
            status_code=404,
            content={
                "message": "Frontend no disponible. En desarrollo usá el servidor de Next.js "
                "(puerto 3000). En producción este endpoint sirve el build estático."
            },
        )

    candidate = (_dist / full_path).resolve() if full_path else index
    if full_path and candidate.is_file() and candidate.is_relative_to(_dist.resolve()):
        return FileResponse(candidate)

    # Rutas exportadas como carpeta (p. ej. /login -> login/index.html)
    as_dir_index = _dist / full_path / "index.html"
    if full_path and as_dir_index.is_file():
        return FileResponse(as_dir_index)
    as_html = _dist / f"{full_path.rstrip('/')}.html"
    if full_path and as_html.is_file():
        return FileResponse(as_html)

    return FileResponse(index)
