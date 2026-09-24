"""Crea la base de datos (si no existe) y aplica las migraciones de Alembic.

    python -m app.db_init            # crea la DB y corre `alembic upgrade head`
    python -m app.db_init --reset    # dropea todas las tablas y migra desde cero
    python -m app.db_init --downgrade 0001   # vuelve a una migración anterior (rollback)

Las bases creadas antes de Alembic (con `create_all`) se adoptan solas: la
migración 0001 crea solo lo que falta y agrega las columnas nuevas.
Corre en cada arranque del contenedor (ver docker-compose*.yml).
"""
import sys
from urllib.parse import urlsplit

from sqlalchemy import create_engine, text

from .config import DATABASE_URL
from .database import _to_sqlalchemy_url, engine
from .migrate import current_revision, downgrade_to, upgrade_head


def ensure_database() -> str:
    url = _to_sqlalchemy_url(DATABASE_URL)
    parts = urlsplit(url)
    db_name = parts.path.lstrip("/")
    server_url = url.replace(f"/{db_name}", "/")

    server_engine = create_engine(server_url, pool_pre_ping=True)
    try:
        with server_engine.begin() as conn:
            conn.execute(
                text(
                    f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
                    "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                )
            )
    except Exception as exc:  # usuarios sin permiso global (p. ej. Docker) — la DB ya existe
        print(f"Aviso: no se pudo ejecutar CREATE DATABASE ({exc.__class__.__name__}); se asume que ya existe.")
    finally:
        server_engine.dispose()
    return db_name


def main() -> None:
    reset = "--reset" in sys.argv
    db_name = ensure_database()

    if "--downgrade" in sys.argv:
        target = sys.argv[sys.argv.index("--downgrade") + 1]
        downgrade_to(target)
        print(f"Base '{db_name}' en la migración {current_revision()}.")
        return

    if reset:
        print(f"Eliminando tablas de {db_name}...")
        # Dropea TODAS las tablas de la base (incluye tablas de esquemas viejos)
        with engine.begin() as conn:
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
            tables = conn.execute(
                text(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema = :db"
                ),
                {"db": db_name},
            ).scalars().all()
            for table in tables:
                conn.execute(text(f"DROP TABLE IF EXISTS `{table}`"))
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))

    upgrade_head()
    print(f"Base '{db_name}' lista (migración {current_revision()}).")


if __name__ == "__main__":
    main()
