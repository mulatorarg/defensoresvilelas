"""Usuarios del staff, subida de imágenes, noticias y eventos (propuestas sección 4)."""
import io
import os
from pathlib import Path

from PIL import Image

from .conftest import new_dni


def _login(client, email, password):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def _headers(res) -> dict:
    return {"Authorization": f"Bearer {res.json()['accessToken']}"}


def _png(size=(1200, 900), color=(200, 30, 30)) -> bytes:
    buffer = io.BytesIO()
    image = Image.new("RGB", size, color)
    exif = Image.Exif()
    exif[0x010F] = "CamaraConGPS"  # Make
    image.save(buffer, "PNG", exif=exif)
    return buffer.getvalue()


# --- Usuarios --------------------------------------------------------------------


def test_abm_de_usuarios(client, admin):
    email = f"profe{new_dni()}@clubes.local"
    res = client.post("/api/users", json={
        "email": email, "password": "clave-segura-1", "firstName": "Profe", "lastName": "Nuevo", "role": "TEACHER",
    }, headers=admin)
    assert res.status_code == 201, res.text
    user = res.json()
    assert "passwordHash" not in user and user["role"] == "TEACHER"

    dup = client.post("/api/users", json={
        "email": email.upper(), "password": "clave-segura-1", "firstName": "X", "lastName": "Y", "role": "STAFF",
    }, headers=admin)
    assert dup.status_code == 409

    session = _headers(_login(client, email, "clave-segura-1"))
    # TEACHER no administra usuarios
    assert client.get("/api/users", headers=session).status_code == 403

    # Cambiar el rol cierra sus sesiones
    client.patch(f"/api/users/{user['id']}", json={"role": "OPERATOR"}, headers=admin)
    assert client.get("/api/members", headers=session).status_code == 401
    session = _headers(_login(client, email, "clave-segura-1"))
    assert client.get("/api/transactions", headers=session).status_code == 200

    # Blanqueo de contraseña
    assert client.post(f"/api/users/{user['id']}/reset-password", json={"newPassword": "otra-clave-22"},
                       headers=admin).status_code == 200
    assert client.get("/api/members", headers=session).status_code == 401
    assert _login(client, email, "clave-segura-1").status_code == 401
    assert _login(client, email, "otra-clave-22").status_code == 200

    # Desactivar
    client.patch(f"/api/users/{user['id']}", json={"isActive": False}, headers=admin)
    assert _login(client, email, "otra-clave-22").status_code == 401


def test_no_quedarse_sin_administradores(client, admin):
    me = next(u for u in client.get("/api/users", headers=admin).json() if u["email"] == "admin@clubes.local")
    res = client.patch(f"/api/users/{me['id']}", json={"role": "OPERATOR"}, headers=admin)
    assert res.status_code == 400
    res = client.patch(f"/api/users/{me['id']}", json={"isActive": False}, headers=admin)
    assert res.status_code == 400


# --- Imágenes --------------------------------------------------------------------


def test_subida_de_imagen(client, admin):
    res = client.post("/api/uploads", data={"folder": "socios"},
                      files={"file": ("foto.png", _png(), "image/png")}, headers=admin)
    assert res.status_code == 201, res.text
    url = res.json()["url"]
    assert url.startswith("/recursos/socios/") and url.endswith(".webp")

    path = Path(os.environ["RECURSOS_DIR"]) / url.removeprefix("/recursos/")
    with Image.open(path) as saved:
        assert saved.format == "WEBP"
        assert max(saved.size) == 800  # achicada al máximo de la carpeta
        assert not saved.getexif()  # sin metadatos
    # Se sirve desde /recursos
    assert client.get(url).status_code == 200


def test_subida_rechaza_lo_que_no_es_imagen(client, admin, make_member):
    fake = client.post("/api/uploads", data={"folder": "socios"},
                       files={"file": ("x.png", b"<?php echo 1; ?>", "image/png")}, headers=admin)
    assert fake.status_code == 400
    folder = client.post("/api/uploads", data={"folder": "../etc"},
                         files={"file": ("f.png", _png(), "image/png")}, headers=admin)
    assert folder.status_code == 400


def test_cambiar_foto_borra_la_anterior(client, admin, make_member):
    first = client.post("/api/uploads", data={"folder": "socios"},
                        files={"file": ("a.png", _png(), "image/png")}, headers=admin).json()["url"]
    second = client.post("/api/uploads", data={"folder": "socios"},
                         files={"file": ("b.png", _png(color=(0, 0, 200)), "image/png")}, headers=admin).json()["url"]
    member = make_member(photoUrl=first)
    root = Path(os.environ["RECURSOS_DIR"])
    assert (root / first.removeprefix("/recursos/")).exists()

    client.patch(f"/api/members/{member['id']}", json={"photoUrl": second}, headers=admin)
    assert not (root / first.removeprefix("/recursos/")).exists()
    assert (root / second.removeprefix("/recursos/")).exists()


# --- Noticias y eventos ----------------------------------------------------------


def test_noticias(client, admin):
    title = f"Gran final {new_dni()}"
    draft = client.post("/api/news", json={"title": title, "excerpt": "Resumen"}, headers=admin).json()
    assert draft["published"] is False and draft["publishedAt"] is None
    public = client.get("/api/public/news?limit=20").json()
    assert all(n["id"] != draft["id"] for n in public)

    published = client.patch(f"/api/news/{draft['id']}", json={"published": True}, headers=admin).json()
    assert published["publishedAt"]
    assert any(n["id"] == draft["id"] for n in client.get("/api/public/news?limit=20").json())

    twin = client.post("/api/news", json={"title": title}, headers=admin).json()
    assert twin["slug"] == draft["slug"] + "-2"

    assert client.delete(f"/api/news/{draft['id']}", headers=admin).status_code == 200
    assert all(n["id"] != draft["id"] for n in client.get("/api/news?limit=100", headers=admin).json()["items"])


def test_eventos_en_hora_del_club(client, admin):
    res = client.post("/api/events", json={
        "title": "Cena anual", "eventDate": "2099-10-05T18:00", "location": "Sede",
    }, headers=admin)
    assert res.status_code == 201
    event = res.json()
    # 18:00 en Argentina (UTC-3) = 21:00 UTC
    assert event["eventDate"].startswith("2099-10-05T21:00:00")

    updated = client.patch(f"/api/events/{event['id']}", json={"isPublic": False}, headers=admin).json()
    assert updated["isPublic"] is False
    assert all(e["id"] != event["id"] for e in client.get("/api/public/events?limit=20").json())
    assert client.delete(f"/api/events/{event['id']}", headers=admin).status_code == 200
