"""Migraciones con Alembic, configuradas por código (no hace falta alembic.ini).

La CLI (`alembic revision --autogenerate -m "..."`) usa apps/backend/alembic.ini,
que apunta a esta misma carpeta de migraciones.
"""
from pathlib import Path

from alembic import command
from alembic.config import Config

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"


def alembic_config() -> Config:
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    return config


def upgrade_head() -> None:
    command.upgrade(alembic_config(), "head")


def downgrade_to(revision: str) -> None:
    command.downgrade(alembic_config(), revision)


def current_revision() -> str | None:
    from alembic.runtime.migration import MigrationContext

    from .database import engine

    with engine.connect() as conn:
        return MigrationContext.configure(conn).get_current_revision()
