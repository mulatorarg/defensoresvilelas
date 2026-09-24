"""Búsqueda, reportes paginados, CSV, morosidad, anulación de cuotas y recibo (propuestas 3 y 4)."""
import csv
import io
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import update

from app import clock, models

from .conftest import new_dni


def _csv(res) -> list[list[str]]:
    assert res.status_code == 200, res.text
    assert res.headers["content-type"].startswith("text/csv")
    assert "attachment" in res.headers["content-disposition"]
    text = res.content.decode("utf-8")
    assert text.startswith("\ufeff")  # BOM: Excel detecta UTF-8
    return list(csv.reader(io.StringIO(text.removeprefix("\ufeff")), delimiter=";"))


# --- 3.2 Búsqueda --------------------------------------------------------------


def test_busqueda_por_dni_y_por_palabras(client, admin, make_member):
    dni = new_dni()
    member = make_member(firstName="Juana Inés", lastName="Pereyra Lucena", dni=dni)

    by_dni = client.get(f"/api/members?search={dni[:6]}", headers=admin).json()["items"]
    assert any(m["id"] == member["id"] for m in by_dni)

    by_words = client.get("/api/members?search=juana lucena", headers=admin).json()["items"]
    assert [m["id"] for m in by_words] == [member["id"]]

    nothing = client.get("/api/members?search=juana gomez", headers=admin).json()["items"]
    assert nothing == []


# --- 3.3 Reportes paginados y CSV ---------------------------------------------


def test_reporte_de_socios_paginado(client, admin):
    res = client.get("/api/reports/members?page=1&limit=5", headers=admin).json()
    assert len(res["items"]) <= 5
    assert res["meta"]["limit"] == 5 and res["meta"]["total"] == res["total"]
    assert res["meta"]["total"] >= len(res["items"])


def test_reporte_de_cuotas_totales_sobre_todo_el_filtro(client, admin):
    page1 = client.get("/api/reports/fees?limit=2", headers=admin).json()
    everything = client.get("/api/reports/fees?limit=200", headers=admin).json()
    assert len(page1["items"]) <= 2
    assert page1["summary"] == everything["summary"]


def test_csv_de_socios_con_proteccion_de_formulas(client, admin, make_member):
    make_member(firstName="Mal", lastName="=HYPERLINK(\"http://x\")")
    rows = _csv(client.get("/api/reports/members.csv", headers=admin))
    assert rows[0][:4] == ["Nº socio", "Apellido", "Nombre", "DNI"]
    dangerous = [r for r in rows if "HYPERLINK" in ";".join(r)]
    assert dangerous and all(r[1].startswith("'=") for r in dangerous)


def test_csv_de_cuotas_y_caja(client, admin):
    fees = _csv(client.get("/api/reports/fees.csv", headers=admin))
    assert fees[0][0] == "Período" and len(fees) > 1

    today = clock.local_today()
    frm = (today - timedelta(days=30)).isoformat()
    cash = _csv(client.get(f"/api/reports/cash.csv?from={frm}&to={today.isoformat()}", headers=admin))
    assert cash[0] == ["Fecha", "Tipo", "Origen", "Concepto", "Detalle", "Monto"]
    assert len(cash) > 1  # el seed demo carga pagos y movimientos del mes

    bad = client.get(f"/api/reports/cash.csv?from={today.isoformat()}&to={frm}", headers=admin)
    assert bad.status_code == 400


def test_listados_con_tope(client, admin):
    assert len(client.get("/api/transactions?limit=1", headers=admin).json()) <= 1
    assert len(client.get("/api/attendances?limit=1", headers=admin).json()) <= 1
    assert client.get("/api/attendances?limit=99999", headers=admin).status_code == 400


# --- Morosidad -----------------------------------------------------------------


def test_morosidad(client, admin, make_member, make_fee, db):
    member = make_member(phone="3624112233")
    vencida = make_fee(member["id"], amount="1000", period="2024-01")
    pagada = make_fee(member["id"], amount="500", period="2024-02")
    client.post("/api/payments", json={"feeId": pagada["id"], "amount": "500", "method": "CASH"}, headers=admin)
    futura = make_fee(member["id"], amount="700", period="2099-01")
    # Una con vencimiento en el futuro y período viejo: no está vencida
    no_vencida = make_fee(member["id"], amount="300", period="2024-03")
    db.execute(update(models.Fee).where(models.Fee.id == no_vencida["id"]).values(
        dueDate=datetime.now() + timedelta(days=10)))
    db.commit()

    res = client.get("/api/reports/delinquency", headers=admin).json()
    entry = next(m for m in res["items"] if m["member"]["id"] == member["id"])
    ids = {f["id"] for f in entry["fees"]}
    assert vencida["id"] in ids
    assert pagada["id"] not in ids and futura["id"] not in ids and no_vencida["id"] not in ids
    assert Decimal(entry["total"]) == Decimal("1000")
    assert entry["member"]["phone"] == "3624112233"
    assert Decimal(res["summary"]["total"]) >= Decimal("1000")

    rows = _csv(client.get("/api/reports/delinquency.csv", headers=admin))
    assert rows[0][-1] == "Deuda"


# --- Anulación de cuotas -------------------------------------------------------


def test_anular_cuota(client, admin, make_member, make_fee):
    member = make_member()
    fee = make_fee(member["id"], amount="800", period="2024-05")

    assert client.post(f"/api/fees/{fee['id']}/cancel", json={"reason": ""}, headers=admin).status_code == 400
    res = client.post(f"/api/fees/{fee['id']}/cancel", json={"reason": "Generada por error"}, headers=admin)
    assert res.status_code == 200
    assert res.json()["status"] == "CANCELLED" and res.json()["cancelReason"] == "Generada por error"

    again = client.post(f"/api/fees/{fee['id']}/cancel", json={"reason": "otra vez"}, headers=admin)
    assert again.status_code == 400
    pay = client.post("/api/payments", json={"feeId": fee["id"], "amount": "100", "method": "CASH"}, headers=admin)
    assert pay.status_code == 400

    # No aparece como deuda del socio en su portal ni en la morosidad
    delinquent = client.get("/api/reports/delinquency", headers=admin).json()["items"]
    assert all(f["id"] != fee["id"] for m in delinquent for f in m["fees"])


def test_no_se_anula_una_cuota_con_pagos(client, admin, make_member, make_fee):
    member = make_member()
    fee = make_fee(member["id"], amount="800", period="2024-06")
    client.post("/api/payments", json={"feeId": fee["id"], "amount": "100", "method": "CASH"}, headers=admin)
    res = client.post(f"/api/fees/{fee['id']}/cancel", json={"reason": "Error"}, headers=admin)
    assert res.status_code == 400


# --- Recibo --------------------------------------------------------------------


def test_recibo_de_pago(client, admin, make_member, make_fee):
    member = make_member()
    fee = make_fee(member["id"], amount="1000", period="2024-07")
    pay = client.post("/api/payments", json={"feeId": fee["id"], "amount": "400", "method": "TRANSFER"},
                      headers=admin).json()
    receipt = client.get(f"/api/payments/{pay['id']}", headers=admin).json()
    assert receipt["receiptNumber"] == pay["id"][-8:].upper()
    assert receipt["member"]["dni"] == member["dni"]
    assert receipt["fee"]["period"] == "2024-07" and receipt["fee"]["balance"] == "600.00"
    assert receipt["club"]["name"]
    assert client.get("/api/payments/inexistente", headers=admin).status_code == 404
