"""Sesiones del staff: login, revocación y validación contra la base (propuestas 1.4)."""
from datetime import datetime, timedelta, timezone

import jwt
from sqlalchemy import update

from app import models

from .conftest import ADMIN, login_admin


def test_login_invalido(client):
    res = client.post("/api/auth/login", json={**ADMIN, "password": "mala"})
    assert res.status_code == 401


def test_sin_token(client):
    assert client.get("/api/members").status_code == 401


def test_token_sin_claim_tv_sigue_valiendo(client, admin, db):
    """Tokens emitidos antes de la revocación (sin "tv") valen mientras version = 0."""
    user = db.query(models.User).filter_by(email=ADMIN["email"]).one()
    if user.tokenVersion:
        return  # otro test ya cerró sesiones; el caso no aplica
    legacy = jwt.encode(
        {"sub": user.id, "email": user.email, "role": "ADMIN",
         "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        "pytest-jwt-secret-con-mas-de-32-caracteres", algorithm="HS256",
    )
    res = client.get("/api/members?limit=1", headers={"Authorization": f"Bearer {legacy}"})
    assert res.status_code == 200


def test_rol_y_estado_se_leen_de_la_base(client, admin, db):
    user_id = db.query(models.User.id).filter_by(email=ADMIN["email"]).scalar()
    try:
        db.execute(update(models.User).where(models.User.id == user_id).values(role="TEACHER"))
        db.commit()
        assert client.get("/api/club/config", headers=admin).status_code == 403

        db.execute(update(models.User).where(models.User.id == user_id).values(role="ADMIN", isActive=False))
        db.commit()
        assert client.get("/api/members", headers=admin).status_code == 401
    finally:
        db.execute(update(models.User).where(models.User.id == user_id).values(role="ADMIN", isActive=True))
        db.commit()
    assert client.get("/api/club/config", headers=admin).status_code == 200


def test_logout_all_revoca_tokens(client):
    first = login_admin(client)
    second = login_admin(client)
    assert client.post("/api/auth/logout-all", headers=first).status_code == 200
    assert client.get("/api/members", headers=first).status_code == 401
    assert client.get("/api/members", headers=second).status_code == 401
    assert client.get("/api/members", headers=login_admin(client)).status_code == 200


def test_cambio_de_contrasena(client):
    headers = login_admin(client)
    bad = client.post("/api/auth/change-password",
                      json={"currentPassword": "x", "newPassword": "nueva-clave-123"}, headers=headers)
    assert bad.status_code == 400

    res = client.post("/api/auth/change-password",
                      json={"currentPassword": "admin123", "newPassword": "nueva-clave-123"}, headers=headers)
    assert res.status_code == 200
    new_headers = {"Authorization": f"Bearer {res.json()['accessToken']}"}
    assert client.get("/api/members", headers=headers).status_code == 401
    assert client.get("/api/members", headers=new_headers).status_code == 200

    # Se restaura para el resto de la suite
    res = client.post("/api/auth/change-password",
                      json={"currentPassword": "nueva-clave-123", "newPassword": "admin123"},
                      headers=new_headers)
    assert res.status_code == 200
