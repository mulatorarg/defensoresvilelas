"""Motor SQLAlchemy sobre la misma MariaDB que usa Prisma (tablas en español)."""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .config import DATABASE_URL, DB_MAX_OVERFLOW, DB_POOL_SIZE


def _to_sqlalchemy_url(url: str) -> str:
    # Prisma usa mysql://user:pass@host:3306/db ; SQLAlchemy necesita el driver explícito
    if url.startswith("mysql://"):
        return "mysql+pymysql://" + url[len("mysql://"):]
    return url


engine = create_engine(
    _to_sqlalchemy_url(DATABASE_URL),
    pool_pre_ping=True,
    pool_recycle=280,
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_MAX_OVERFLOW,
    # Sesión en UTC al abrir cada conexión (no por request): NOW(), CURRENT_TIMESTAMP
    # y las consultas manuales dan lo mismo que la app, sin importar la zona
    # configurada en el MariaDB del VPS. Ver clock.py.
    connect_args={"init_command": "SET time_zone = '+00:00'"},
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
