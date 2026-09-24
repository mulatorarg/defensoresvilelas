"""Imágenes propias del club, pagos del socio, captcha, CSP con hashes y auditoría."""
import base64
import hashlib
import re
from pathlib import Path

import pytest

from app import captcha, csp
from app.config import FRONTEND_DIST_PATH

from .conftest import new_dni


# --- Fotos propias (portada y disciplinas) --------------------------------------


def test_portada_y_foto_de_disciplina(client, admin):
    res = client.patch("/api/club/config", json={"heroImageUrl": "/recursos/club/portada.webp"}, headers=admin)
    assert res.status_code == 200
    assert client.get("/api/club").json()["heroImageUrl"] == "/recursos/club/portada.webp"
    client.patch("/api/club/config", json={"heroImageUrl": None}, headers=admin)

    discipline = client.post("/api/disciplines", json={
        "name": f"Handball {new_dni()}", "imageUrl": "/recursos/club/handball.webp",
    }, headers=admin).json()
    assert discipline["imageUrl"] == "/recursos/club/handball.webp"
    public = client.get("/api/public/disciplines").json()
    assert any(d["id"] == discipline["id"] and d["imageUrl"] for d in public)

    cleared = client.patch(f"/api/disciplines/{discipline['id']}", json={"imageUrl": ""}, headers=admin).json()
    assert cleared["imageUrl"] is None


# --- Pagos y recibos en el portal del socio -------------------------------------


def _member_session(client, member) -> dict:
    res = client.post("/api/member-portal/login", json={
        "dni": member["dni"], "birthDate": "1990-05-10", "newPin": "1234",
    })
    return {"Authorization": f"Bearer {res.json()['accessToken']}"}


def test_socio_ve_sus_pagos_y_recibos(client, admin, make_member, make_fee):
    member = make_member()
    other = make_member()
    fee = make_fee(member["id"], amount="1000", period="2025-03")
    other_fee = make_fee(other["id"], amount="1000", period="2025-03")
    mine = client.post("/api/payments", json={"feeId": fee["id"], "amount": "300", "method": "CASH"},
                       headers=admin).json()
    theirs = client.post("/api/payments", json={"feeId": other_fee["id"], "amount": "300", "method": "CASH"},
                         headers=admin).json()

    session = _member_session(client, member)
    payments = client.get("/api/member-portal/me/payments", headers=session).json()
    assert [p["id"] for p in payments] == [mine["id"]]
    assert payments[0]["period"] == "2025-03" and payments[0]["receiptNumber"]

    receipt = client.get(f"/api/member-portal/me/payments/{mine['id']}", headers=session)
    assert receipt.status_code == 200 and receipt.json()["fee"]["balance"] == "700.00"
    # No puede ver el recibo de otro socio
    assert client.get(f"/api/member-portal/me/payments/{theirs['id']}", headers=session).status_code == 404


# --- Captcha ------------------------------------------------------------------------


def test_alta_con_captcha(client, monkeypatch):
    calls = []
    monkeypatch.setattr(captcha, "enabled", lambda: True)
    monkeypatch.setattr(captcha, "verify", lambda token, ip=None: calls.append(token) or token == "ok")

    body = {"firstName": "Cap", "lastName": "Tcha", "dni": new_dni(), "birthDate": "2001-02-03"}
    assert client.post("/api/public/register", json=body).status_code == 400
    assert client.post("/api/public/register", json={**body, "captchaToken": "malo"}).status_code == 400
    ok = client.post("/api/public/register", json={**body, "captchaToken": "ok"})
    assert ok.status_code == 201, ok.text
    assert calls == [None, "malo", "ok"]


def test_captcha_rechaza_si_cloudflare_no_responde(monkeypatch):
    monkeypatch.setattr(captcha, "VERIFY_URL", "http://127.0.0.1:9/no-existe")
    assert captcha.verify("token") is False
    assert captcha.verify(None) is False


# --- CSP con hashes -------------------------------------------------------------


def test_politica_por_defecto_sin_unsafe_inline_en_scripts(client):
    policy = client.get("/api/club").headers["content-security-policy"]
    script_src = re.search(r"script-src ([^;]+)", policy).group(1)
    assert "'unsafe-inline'" not in script_src
    assert "frame-ancestors 'none'" in policy


def test_hashes_de_scripts_inline(tmp_path):
    html = tmp_path / "index.html"
    html.write_text(
        '<html><head><script src="/a.js"></script><script>alert("hola")</script></head>'
        "<body><script>self.x=1</script></body></html>",
        encoding="utf-8",
    )
    policy = csp.policy_for_html(html)
    for script in ('alert("hola")', "self.x=1"):
        digest = base64.b64encode(hashlib.sha256(script.encode()).digest()).decode()
        assert f"'sha256-{digest}'" in policy
    assert "'unsafe-inline'" not in re.search(r"script-src ([^;]+)", policy).group(1)


@pytest.mark.skipif(not (Path(FRONTEND_DIST_PATH) / "index.html").exists(), reason="sin build del frontend")
def test_paginas_con_su_politica(client):
    res = client.get("/")
    assert "'sha256-" in res.headers["content-security-policy"]
    assert res.headers["cache-control"] == "no-cache"


# --- Auditoría ------------------------------------------------------------------


def test_auditoria_filtra_por_accion(client, admin, make_member):
    member = make_member()
    client.delete(f"/api/members/{member['id']}", headers=admin)
    items = client.get("/api/audit?action=DEACTIVATE&limit=200", headers=admin).json()["items"]
    assert items and all(i["action"] == "DEACTIVATE" for i in items)
    assert any(i["entityId"] == member["id"] for i in items)


# --- PWA del portal ----------------------------------------------------------------


def test_manifiesto_del_portal(client):
    res = client.get("/socio/manifest.webmanifest")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/manifest+json")
    manifest = res.json()
    assert manifest["start_url"] == "/socio/" and manifest["scope"] == "/socio/"
    assert "Portal del socio" in manifest["name"]
    assert any(icon.get("purpose") == "maskable" for icon in manifest["icons"])
