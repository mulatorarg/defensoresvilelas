"""Configuración del club, credenciales de MP, webhook, CORS, headers y health."""
from sqlalchemy import text

from app import crypto, models


def test_credenciales_mp_cifradas_y_enmascaradas(client, admin, db):
    res = client.patch("/api/club/config", json={
        "mpAccessToken": "APP_USR-9999-abcdefgh-5678",
        "mpWebhookSecret": "whsec-supersecreto-0000",
    }, headers=admin)
    assert res.status_code == 200
    assert res.json()["mpAccessToken"] == "APP_USR-****5678"
    assert res.json()["mpWebhookSecret"] == "whsec-****0000"

    stored = db.get(models.ClubConfig, "club").mpAccessToken
    assert stored.startswith("enc:") and "9999" not in stored
    assert crypto.decrypt(stored) == "APP_USR-9999-abcdefgh-5678"

    # Reenviar el valor enmascarado no pisa el real
    client.patch("/api/club/config", json={"mpAccessToken": "APP_USR-****5678"}, headers=admin)
    db.expire_all()
    assert db.get(models.ClubConfig, "club").mpAccessToken == stored


def test_zona_horaria(client, db):
    # La API informa la zona del club (la usa el frontend para mostrar fechas)
    assert client.get("/api/club").json()["timezone"] == "America/Argentina/Buenos_Aires"
    # La sesión de MariaDB está en UTC aunque el servidor tenga otra zona
    assert db.execute(text("SELECT @@session.time_zone")).scalar() == "+00:00"


def test_webhook_exige_firma(client, admin):
    client.patch("/api/club/config", json={"mpWebhookSecret": ""}, headers=admin)
    body = {"type": "payment", "data": {"id": "123"}}
    assert client.post("/api/payments/mercado-pago/webhook?data.id=123", json=body).status_code == 401

    client.patch("/api/club/config", json={"mpWebhookSecret": "whsec-supersecreto-0000"}, headers=admin)
    res = client.post("/api/payments/mercado-pago/webhook?data.id=123", json=body,
                      headers={"x-signature": "ts=1,v1=abc"})
    assert res.status_code == 401


def test_cors(client):
    evil = client.get("/api/club", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in evil.headers
    ok = client.get("/api/club", headers={"Origin": "http://localhost:3000"})
    assert ok.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_headers_de_seguridad(client):
    res = client.get("/api/club")
    assert "frame-ancestors 'none'" in res.headers["content-security-policy"]
    assert res.headers["x-frame-options"] == "DENY"
    assert "strict-transport-security" not in res.headers
    https = client.get("/health", headers={"X-Forwarded-Proto": "https"})
    assert "strict-transport-security" in https.headers


def test_docs_desactivados(client):
    assert client.get("/api/docs").status_code == 404
    assert client.get("/api/openapi.json").status_code == 404


def test_health_verifica_la_base(client):
    res = client.get("/health")
    assert res.status_code == 200 and res.json()["database"] == "ok"


def test_request_id(client):
    res = client.get("/health", headers={"X-Request-ID": "abc123"})
    assert res.headers["x-request-id"] == "abc123"
    assert len(client.get("/health").headers["x-request-id"]) == 16


def test_auditoria(client, admin):
    res = client.get("/api/audit?limit=100", headers=admin)
    assert res.status_code == 200
    actions = {(a["action"], a["entity"]) for a in res.json()["items"]}
    assert ("UPDATE", "club_config") in actions
