"""Fixtures de la suite: base MariaDB de test creada con las migraciones reales.

Uso (desde apps/backend, con MariaDB corriendo):
    pip install -r requirements-dev.txt
    pytest

La base sale de TEST_DATABASE_URL (default mysql://root@localhost:3306/clubes_test)
y se borra y recrea en cada corrida: por seguridad el nombre debe contener "test".
"""
import itertools
import os
import tempfile

import pytest

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "mysql://root@localhost:3306/clubes_test"
)
if "test" not in TEST_DATABASE_URL.rsplit("/", 1)[-1]:
    raise RuntimeError("TEST_DATABASE_URL debe apuntar a una base cuyo nombre contenga 'test'")

# Antes de importar la app: config.py lee el entorno al importarse (y load_dotenv
# no pisa variables ya definidas, así el .env de desarrollo no interfiere)
os.environ.update({
    "DATABASE_URL": TEST_DATABASE_URL,
    "JWT_SECRET": "pytest-jwt-secret-con-mas-de-32-caracteres",
    "QR_SECRET": "pytest-qr-secret-con-mas-de-32-caracteres",
    "FRONTEND_URL": "http://localhost:3000",
    "ENABLE_DOCS": "0",
    "SECRETS_KEY": "",
    "MERCADO_PAGO_ACCESS_TOKEN": "",
    "MERCADO_PAGO_WEBHOOK_SECRET": "",
    "SENTRY_DSN": "",
    "CLUB_TIMEZONE": "America/Argentina/Buenos_Aires",
    "CLUB_NAME": "Club de Test",
    "ADMIN_EMAIL": "admin@clubes.local",
    "ADMIN_PASSWORD": "admin123",
    "SEED_DEMO": "1",
    # Las imágenes subidas en los tests van a una carpeta temporal, no a recursos/
    "RECURSOS_DIR": tempfile.mkdtemp(prefix="clubes-test-recursos-"),
})

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app import db_init, seed  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.migrate import upgrade_head  # noqa: E402

ADMIN = {"email": "admin@clubes.local", "password": "admin123"}
_dni = itertools.count(40_000_001)


@pytest.fixture(scope="session", autouse=True)
def database():
    db_name = db_init.ensure_database()
    with engine.begin() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        tables = conn.execute(
            text("SELECT table_name FROM information_schema.tables WHERE table_schema = :db"),
            {"db": db_name},
        ).scalars().all()
        for table in tables:
            conn.execute(text(f"DROP TABLE IF EXISTS `{table}`"))
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
    upgrade_head()
    seed.main()
    yield
    engine.dispose()


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.rollback()
    session.close()


def login_admin(client) -> dict:
    res = client.post("/api/auth/login", json=ADMIN)
    assert res.status_code in (200, 201), res.text
    return {"Authorization": f"Bearer {res.json()['accessToken']}"}


@pytest.fixture
def admin(client) -> dict:
    """Headers de un ADMIN recién logueado (cada test tiene su propia sesión)."""
    return login_admin(client)


def new_dni() -> str:
    return str(next(_dni))


@pytest.fixture
def make_member(client, admin):
    def _make(**overrides) -> dict:
        body = {
            "firstName": "Socio",
            "lastName": "De Prueba",
            "dni": new_dni(),
            "birthDate": "1990-05-10",
            **overrides,
        }
        res = client.post("/api/members", json=body, headers=admin)
        assert res.status_code == 201, res.text
        return res.json()

    return _make


@pytest.fixture
def fee_type(client, admin) -> dict:
    res = client.post("/api/fee-types", json={"name": f"Tipo {new_dni()}"}, headers=admin)
    assert res.status_code == 201, res.text
    return res.json()


@pytest.fixture
def make_fee(client, admin, fee_type):
    def _make(member_id: str, amount: str = "1000", period: str = "2026-01") -> dict:
        res = client.post("/api/fees/generate", json={
            "feeTypeId": fee_type["id"],
            "period": period,
            "amount": amount,
            "memberIds": [member_id],
        }, headers=admin)
        assert res.status_code == 201 and res.json()["created"] == 1, res.text
        fees = client.get(
            f"/api/fees?memberId={member_id}&period={period}", headers=admin
        ).json()["items"]
        return next(f for f in fees if f["feeType"]["id"] == fee_type["id"])

    return _make
