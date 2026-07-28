"""Configuración: carga .env desde la raíz del monorepo (igual que el backend Nest)."""
import os
from pathlib import Path

from dotenv import load_dotenv

# apps/backend-py/app/config.py -> raíz del monorepo dos niveles arriba de apps/backend-py
# (en Docker la app vive en /app y no hay raíz de monorepo: se usan variables de entorno)
_parents = Path(__file__).resolve().parents
ROOT_DIR = _parents[3] if len(_parents) > 3 else _parents[-1]
load_dotenv(ROOT_DIR / ".env")
load_dotenv()  # fallback: .env local si existe


def _require_jwt_secret() -> str:
    secret = (os.getenv("JWT_SECRET") or "").strip()
    if len(secret) < 32:
        raise RuntimeError(
            "JWT_SECRET debe estar definido y tener al menos 32 caracteres. Revisá tu archivo .env."
        )
    return secret


DATABASE_URL = os.getenv("DATABASE_URL", "")
JWT_SECRET = _require_jwt_secret()
QR_SECRET = os.getenv("QR_SECRET") or JWT_SECRET
FRONTEND_URL = os.getenv("FRONTEND_URL")
API_PUBLIC_URL = os.getenv("API_PUBLIC_URL")
MERCADO_PAGO_ACCESS_TOKEN = os.getenv("MERCADO_PAGO_ACCESS_TOKEN")
MERCADO_PAGO_WEBHOOK_SECRET = os.getenv("MERCADO_PAGO_WEBHOOK_SECRET")
PORT = int(os.getenv("PORT", "3001"))

FRONTEND_DIST_PATH = os.getenv(
    "FRONTEND_DIST_PATH",
    str(ROOT_DIR / "apps" / "frontend" / "dist"),
)

# Carpeta persistente de archivos del club (fotos de socios, logos, etc.).
# En Docker se monta como volumen: ./recursos -> /app/recursos
RECURSOS_DIR = os.getenv("RECURSOS_DIR", str(ROOT_DIR / "recursos"))

JWT_EXPIRES_DAYS = 7
QR_EXPIRES_MINUTES = 5
