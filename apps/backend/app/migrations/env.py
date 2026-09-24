"""Entorno de Alembic: usa el engine de la app y los modelos como metadata."""
from alembic import context

from app.database import engine
from app.models import Base

target_metadata = Base.metadata


def run_migrations_online() -> None:
    connectable = context.config.attributes.get("connection")
    if connectable is not None:
        _run(connectable)
        return
    with engine.connect() as connection:
        _run(connection)


def _run(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        render_as_batch=False,
    )
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    raise RuntimeError("Solo se soportan migraciones online (con conexión a la base).")

run_migrations_online()
