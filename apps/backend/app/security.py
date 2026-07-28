"""JWT (PyJWT) y verificación de contraseñas (bcrypt)."""
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from .config import JWT_EXPIRES_DAYS, JWT_SECRET


def verify_password(plain: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def sign_token(
    payload: dict[str, Any],
    *,
    secret: str = JWT_SECRET,
    expires_delta: timedelta | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        **payload,
        "iat": now,
        "exp": now + (expires_delta or timedelta(days=JWT_EXPIRES_DAYS)),
    }
    return jwt.encode(claims, secret, algorithm="HS256")


def verify_token(token: str, *, secret: str = JWT_SECRET) -> dict[str, Any]:
    return jwt.decode(token, secret, algorithms=["HS256"])
