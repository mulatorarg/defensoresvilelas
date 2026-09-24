"""Consistencia de datos (propuestas.md sección 2)."""
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from app import models
from app.ids import new_id
from app.migrate import current_revision


def test_base_en_la_ultima_migracion():
    assert current_revision() == "0002"


# --- 2.2 Uniques ----------------------------------------------------------


def test_generar_cuotas_dos_veces_no_duplica(client, admin, make_member, fee_type):
    member = make_member()
    body = {"feeTypeId": fee_type["id"], "period": "2026-02", "amount": "500", "memberIds": [member["id"]]}
    assert client.post("/api/fees/generate", json=body, headers=admin).json()["created"] == 1
    second = client.post("/api/fees/generate", json=body, headers=admin).json()
    assert second["created"] == 0


def test_unique_de_cuotas_en_la_base(db, make_member, fee_type):
    """El unique vale también con categoría NULL (cuota social), gracias a las claves COALESCE."""
    member = make_member()

    def fee():
        return models.Fee(id=new_id(), memberId=member["id"], feeTypeId=fee_type["id"],
                          categoryId=None, period="2026-03", amount=Decimal("100"))

    db.add(fee())
    db.commit()
    db.add(fee())
    with pytest.raises(IntegrityError):
        db.commit()


def test_pago_de_mp_unico_por_referencia(db, make_member):
    member = make_member()

    def payment(method: str, reference: str):
        return models.Payment(id=new_id(), memberId=member["id"], amount=Decimal("10"),
                              method=method, reference=reference)

    # Los pagos manuales pueden repetir referencia
    db.add_all([payment("CASH", "recibo-1"), payment("CASH", "recibo-1")])
    db.commit()

    db.add(payment("MERCADO_PAGO", "mp-777"))
    db.commit()
    db.add(payment("MERCADO_PAGO", "mp-777"))
    with pytest.raises(IntegrityError):
        db.commit()


def test_inscribir_y_dar_de_baja_varias_veces(client, admin, make_member):
    """Con el unique viejo (socio, categoría, estado) la segunda baja fallaba."""
    member = make_member()
    category_id = client.get("/api/disciplines", headers=admin).json()[0]["categories"][0]["id"]
    for _ in range(3):
        res = client.post("/api/enrollments", json={"memberId": member["id"], "categoryId": category_id},
                          headers=admin)
        assert res.status_code == 201, res.text
        duplicate = client.post("/api/enrollments", json={"memberId": member["id"], "categoryId": category_id},
                                headers=admin)
        assert duplicate.status_code == 409
        assert client.delete(f"/api/enrollments/{res.json()['id']}", headers=admin).status_code == 200


# --- 2.3 Zona horaria -----------------------------------------------------


def test_pago_a_la_noche_cae_en_el_dia_local(client, admin, make_member, make_fee):
    member = make_member()
    fee = make_fee(member["id"], amount="1000", period="2025-09")
    # 01:30 UTC del 10/09 = 22:30 del 09/09 en Argentina
    res = client.post("/api/payments", json={
        "feeId": fee["id"], "amount": "300", "method": "CASH", "paidAt": "2025-09-10T01:30:00Z",
    }, headers=admin)
    assert res.status_code == 201, res.text

    day9 = client.get("/api/reports/cash-closure?date=2025-09-09", headers=admin).json()
    day10 = client.get("/api/reports/cash-closure?date=2025-09-10", headers=admin).json()
    assert Decimal(day9["paymentsIncome"]) >= Decimal("300")
    assert Decimal(day10["paymentsIncome"]) == Decimal("0")


def test_pago_con_solo_fecha_es_del_dia_local(client, admin, make_member, make_fee):
    member = make_member()
    fee = make_fee(member["id"], amount="1000", period="2025-08")
    res = client.post("/api/payments", json={
        "feeId": fee["id"], "amount": "250", "method": "CASH", "paidAt": "2025-08-15",
    }, headers=admin)
    assert res.status_code == 201
    closure = client.get("/api/reports/cash-closure?date=2025-08-15", headers=admin).json()
    assert Decimal(closure["paymentsIncome"]) == Decimal("250.00")


# --- 2.4 Montos como string decimal ---------------------------------------


def test_reportes_devuelven_decimales_como_string(client, admin):
    dashboard = client.get("/api/reports/dashboard", headers=admin).json()
    for key in ("collectedThisMonth", "incomeThisMonth", "expenseThisMonth", "balanceThisMonth"):
        assert isinstance(dashboard[key], str)
    Decimal(dashboard["balanceThisMonth"])

    fees = client.get("/api/reports/fees", headers=admin).json()["summary"]
    assert all(isinstance(v, str) for v in fees.values())
    closure = client.get("/api/reports/cash-closure?date=2025-09-09", headers=admin).json()
    assert isinstance(closure["balance"], str)


# --- 2.5 Anulación de movimientos -----------------------------------------


def test_anular_movimiento_de_caja(client, admin):
    day = "2025-07-20"
    before = Decimal(client.get(f"/api/reports/cash-closure?date={day}", headers=admin).json()["totalIncome"])
    tx = client.post("/api/transactions", json={
        "type": "INCOME", "category": "Buffet", "amount": "150.50", "date": day,
    }, headers=admin).json()
    after = Decimal(client.get(f"/api/reports/cash-closure?date={day}", headers=admin).json()["totalIncome"])
    assert after - before == Decimal("150.50")

    assert client.post(f"/api/transactions/{tx['id']}/void", json={"reason": ""}, headers=admin).status_code == 400
    res = client.post(f"/api/transactions/{tx['id']}/void", json={"reason": "Cargado dos veces"}, headers=admin)
    assert res.status_code == 200
    assert res.json()["status"] == "VOIDED" and res.json()["voidReason"] == "Cargado dos veces"
    assert res.json()["voidedBy"]

    closure = client.get(f"/api/reports/cash-closure?date={day}", headers=admin).json()
    assert Decimal(closure["totalIncome"]) == before
    # Sigue listado (con su estado) para trazabilidad
    listed = client.get(f"/api/transactions?from={day}&to={day}", headers=admin).json()
    assert any(t["id"] == tx["id"] and t["status"] == "VOIDED" for t in listed)
    active_only = client.get(f"/api/transactions?from={day}&to={day}&includeVoided=false", headers=admin).json()
    assert all(t["id"] != tx["id"] for t in active_only)

    assert client.post(f"/api/transactions/{tx['id']}/void", json={"reason": "otra vez"}, headers=admin).status_code == 400
    assert client.delete(f"/api/transactions/{tx['id']}", headers=admin).status_code == 405


# --- 2.6 Pagos contra el saldo --------------------------------------------


def test_pago_no_puede_superar_el_saldo(client, admin, make_member, make_fee):
    member = make_member()
    fee = make_fee(member["id"], amount="1000", period="2025-06")

    def pay(amount):
        return client.post("/api/payments", json={"feeId": fee["id"], "amount": amount, "method": "CASH"},
                           headers=admin)

    assert pay("1500").status_code == 400
    assert pay("400").status_code == 201
    assert pay("700").status_code == 400
    assert pay("600").status_code == 201
    status = client.get(f"/api/fees/{fee['id']}", headers=admin).json()["status"]
    assert status == "PAID"
    res = pay("1")
    assert res.status_code == 400 and "paga" in res.json()["message"]


# --- Regresiones básicas --------------------------------------------------


@pytest.mark.parametrize("path", [
    "/api/members?limit=5", "/api/fees?limit=5", "/api/disciplines", "/api/transactions",
    "/api/reports/dashboard", "/api/reports/members", "/api/reports/income-expense",
    "/api/attendances", "/api/fee-types",
])
def test_listados(client, admin, path):
    assert client.get(path, headers=admin).status_code == 200
