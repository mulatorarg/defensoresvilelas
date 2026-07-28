"""Backend Clubes SaaS en Python (FastAPI).

Réplica del contrato de API del backend NestJS: mismas rutas bajo /api,
mismo formato de errores y misma base MariaDB (tablas en español).
"""
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import FRONTEND_DIST_PATH, FRONTEND_URL, RECURSOS_DIR
from .routers import (
    attendances,
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

app = FastAPI(title="Clubes SaaS API", docs_url="/api/docs", openapi_url="/api/openapi.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL] if FRONTEND_URL else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.get("/health")
def health():
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


for module in (
    auth,
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
