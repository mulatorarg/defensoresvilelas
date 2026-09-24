"""Portal del socio: PIN, bloqueo y revocación de sesiones (propuestas 1.3)."""
from sqlalchemy import update

from app import models

from .conftest import new_dni


def _login(client, member, **extra):
    return client.post("/api/member-portal/login", json={
        "dni": member["dni"], "birthDate": "1990-05-10", **extra,
    })


def _auth(res) -> dict:
    return {"Authorization": f"Bearer {res.json()['accessToken']}"}


def test_primer_ingreso_crea_pin(client, make_member):
    member = make_member()
    res = _login(client, member)
    assert res.status_code == 201 and res.json() == {"pinSetupRequired": True}

    assert _login(client, member, newPin="12ab").status_code == 400
    res = _login(client, member, newPin="1234")
    assert res.status_code == 201
    assert client.get("/api/member-portal/me", headers=_auth(res)).status_code == 200

    # Con PIN definido: newPin no lo pisa y sin PIN no entra
    assert _login(client, member, newPin="9999").status_code == 401
    assert _login(client, member).status_code == 401
    assert _login(client, member, pin="1234").status_code == 201


def test_bloqueo_por_intentos(client, make_member, db):
    member = make_member()
    _login(client, member, newPin="1234")
    for _ in range(5):
        assert _login(client, member, pin="0000").status_code == 401
    # Bloqueado: ni con el PIN correcto
    assert _login(client, member, pin="1234").status_code == 429

    db.execute(update(models.Member).where(models.Member.id == member["id"]).values(pinLockedUntil=None))
    db.commit()
    assert _login(client, member, pin="1234").status_code == 201


def test_blanqueo_y_cambio_de_pin(client, admin, make_member):
    member = make_member()
    session = _auth(_login(client, member, newPin="1234"))

    assert client.post(f"/api/members/{member['id']}/reset-pin", headers=admin).status_code == 200
    assert client.get("/api/member-portal/me/fees", headers=session).status_code == 401
    assert _login(client, member).json() == {"pinSetupRequired": True}

    session = _auth(_login(client, member, newPin="4321"))
    bad = client.post("/api/member-portal/me/pin", json={"currentPin": "0000", "newPin": "5678"}, headers=session)
    assert bad.status_code == 400
    res = client.post("/api/member-portal/me/pin", json={"currentPin": "4321", "newPin": "567890"}, headers=session)
    assert res.status_code == 200
    assert client.get("/api/member-portal/me", headers=session).status_code == 401
    assert client.get("/api/member-portal/me/card", headers=_auth(res)).status_code == 200


def test_socio_dado_de_baja_pierde_la_sesion(client, admin, make_member):
    member = make_member()
    session = _auth(_login(client, member, newPin="1234"))
    client.delete(f"/api/members/{member['id']}", headers=admin)
    assert client.get("/api/member-portal/me", headers=session).status_code == 401


def test_alta_online_deja_la_cuota_pendiente(client, db):
    dni = new_dni()
    res = client.post("/api/public/register", json={
        "firstName": "Ana", "lastName": "Online", "dni": dni, "birthDate": "1995-02-03",
    })
    assert res.status_code == 201, res.text
    assert res.json()["fee"]["status"] == "PENDING"
    member_id = res.json()["member"]["id"]
    assert db.query(models.Payment).filter_by(memberId=member_id).count() == 0


def test_alta_online_honeypot(client):
    res = client.post("/api/public/register", json={
        "firstName": "Bot", "lastName": "Spam", "dni": new_dni(),
        "birthDate": "2000-01-01", "website": "http://spam",
    })
    assert res.status_code == 400
