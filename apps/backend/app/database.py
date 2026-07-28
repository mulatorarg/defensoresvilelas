"""Motor SQLAlchemy sobre la misma MariaDB que usa Prisma (tablas en español)."""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .config import DATABASE_URL


def _to_sqlalchemy_url(url: str) -> str:
    # Prisma usa mysql://user:pass@host:3306/db ; SQLAlchemy necesita el driver explícito
    if url.startswith("mysql://"):
        return "mysql+pymysql://" + url[len("mysql://"):]
    return url


engine = create_engine(
    _to_sqlalchemy_url(DATABASE_URL),
    pool_pre_ping=True,
    pool_recycle=280,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
