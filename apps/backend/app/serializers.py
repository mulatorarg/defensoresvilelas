"""Serialización a JSON con el mismo contrato que producía Prisma/NestJS:
claves camelCase, fechas ISO-8601 con sufijo Z, decimales como string y
campos Json parseados a objetos.
"""
import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from . import models


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def iso_date(d: date | None) -> str | None:
    if d is None:
        return None
    return f"{d.isoformat()}T00:00:00.000Z"


def dec(value: Decimal | None) -> str | None:
    if value is None:
        return None
    return str(value)


def parse_json(text: str | None) -> Any:
    if text is None:
        return None
    try:
        return json.loads(text)
    except (TypeError, ValueError):
        return text


def club_public(c: models.ClubConfig) -> dict:
    """Datos públicos del club para la landing (sin credenciales)."""
    return {
        "name": c.name,
        "legalName": c.legalName,
        "logoUrl": c.logoUrl,
        "primaryColor": c.primaryColor,
        "secondaryColor": c.secondaryColor,
        "address": c.address,
        "phone": c.phone,
        "email": c.email,
        "whatsapp": c.whatsapp,
        "instagram": c.instagram,
        "facebook": c.facebook,
        "website": c.website,
        "monthlyFee": dec(c.monthlyFee),
        "settings": parse_json(c.settings),
    }


def club_config_full(c: models.ClubConfig) -> dict:
    """Configuración completa para el admin (incluye credenciales MP)."""
    data = club_public(c)
    data["document"] = c.document
    data["mpAccessToken"] = c.mpAccessToken
    data["mpWebhookSecret"] = c.mpWebhookSecret
    data["updatedAt"] = iso(c.updatedAt)
    return data


def discipline_ref(d: models.Discipline) -> dict:
    return {"id": d.id, "name": d.name}


def category_base(c: models.Category) -> dict:
    return {
        "id": c.id,
        "disciplineId": c.disciplineId,
        "name": c.name,
        "ageFrom": c.ageFrom,
        "ageTo": c.ageTo,
        "gender": c.gender,
        "feeAmount": dec(c.feeAmount),
        "schedule": c.schedule,
        "isActive": c.isActive,
        "createdAt": iso(c.createdAt),
        "updatedAt": iso(c.updatedAt),
    }


def category_with_discipline(c: models.Category) -> dict:
    data = category_base(c)
    data["discipline"] = discipline_ref(c.discipline)
    return data


def discipline_full(d: models.Discipline, categories: list[models.Category]) -> dict:
    return {
        "id": d.id,
        "name": d.name,
        "description": d.description,
        "icon": d.icon,
        "isActive": d.isActive,
        "createdAt": iso(d.createdAt),
        "updatedAt": iso(d.updatedAt),
        "categories": [category_base(c) for c in categories],
    }


def player_profile(p: models.PlayerProfile | None) -> dict | None:
    if p is None:
        return None
    return {
        "id": p.id,
        "memberId": p.memberId,
        "position": p.position,
        "jerseyNumber": p.jerseyNumber,
        "federationId": p.federationId,
        "medicalPassDue": iso(p.medicalPassDue),
        "notes": p.notes,
    }


def enrollment_with_category(e: models.Enrollment) -> dict:
    return {
        "id": e.id,
        "memberId": e.memberId,
        "categoryId": e.categoryId,
        "enrolledAt": iso(e.enrolledAt),
        "leftAt": iso(e.leftAt),
        "status": e.status,
        "category": category_with_discipline(e.category),
    }


def member_ref(m: models.Member, *, with_dni: bool = False) -> dict:
    data = {"id": m.id, "firstName": m.firstName, "lastName": m.lastName}
    if with_dni:
        data["dni"] = m.dni
    return data


def member_full(m: models.Member) -> dict:
    active_enrollments = [e for e in m.enrollments if e.status == "ACTIVE"]
    return {
        "id": m.id,
        "memberNumber": m.memberNumber,
        "firstName": m.firstName,
        "lastName": m.lastName,
        "dni": m.dni,
        "email": m.email,
        "phone": m.phone,
        "address": m.address,
        "birthDate": iso(m.birthDate),
        "photoUrl": m.photoUrl,
        "status": m.status,
        "notes": m.notes,
        "createdAt": iso(m.createdAt),
        "updatedAt": iso(m.updatedAt),
        "player": player_profile(m.player),
        "enrollments": [enrollment_with_category(e) for e in active_enrollments],
    }


def enrollment_full(e: models.Enrollment) -> dict:
    data = enrollment_with_category(e)
    data["member"] = member_ref(e.member)
    return data


def fee_type(ft: models.FeeType) -> dict:
    return {
        "id": ft.id,
        "name": ft.name,
        "description": ft.description,
        "isActive": ft.isActive,
        "createdAt": iso(ft.createdAt),
    }


def payment(p: models.Payment) -> dict:
    return {
        "id": p.id,
        "memberId": p.memberId,
        "feeId": p.feeId,
        "amount": dec(p.amount),
        "method": p.method,
        "status": p.status,
        "reference": p.reference,
        "metadata": parse_json(p.metadata_json),
        "paidAt": iso(p.paidAt),
        "createdAt": iso(p.createdAt),
        "updatedAt": iso(p.updatedAt),
    }


def fee_base(f: models.Fee) -> dict:
    return {
        "id": f.id,
        "memberId": f.memberId,
        "feeTypeId": f.feeTypeId,
        "categoryId": f.categoryId,
        "period": f.period,
        "amount": dec(f.amount),
        "paidAmount": dec(f.paidAmount),
        "dueDate": iso(f.dueDate),
        "status": f.status,
        "description": f.description,
        "externalReference": f.externalReference,
        "createdAt": iso(f.createdAt),
        "updatedAt": iso(f.updatedAt),
    }


def fee_list_item(f: models.Fee) -> dict:
    data = fee_base(f)
    data["member"] = member_ref(f.member, with_dni=True)
    data["feeType"] = {"id": f.feeType.id, "name": f.feeType.name} if f.feeType else None
    data["category"] = (
        {
            "id": f.category.id,
            "name": f.category.name,
            "discipline": {"name": f.category.discipline.name},
        }
        if f.category
        else None
    )
    data["payments"] = [payment(p) for p in f.payments if p.status == "COMPLETED"]
    return data


def fee_detail(f: models.Fee) -> dict:
    data = fee_base(f)
    data["member"] = member_ref(f.member, with_dni=True)
    data["feeType"] = fee_type(f.feeType) if f.feeType else None
    if f.category:
        cat = category_base(f.category)
        cat["discipline"] = {"name": f.category.discipline.name}
        data["category"] = cat
    else:
        data["category"] = None
    data["payments"] = [payment(p) for p in f.payments]
    return data


def attendance_full(a: models.Attendance) -> dict:
    return {
        "id": a.id,
        "categoryId": a.categoryId,
        "memberId": a.memberId,
        "date": iso_date(a.date),
        "present": a.present,
        "notes": a.notes,
        "createdBy": a.createdBy,
        "createdAt": iso(a.createdAt),
        "member": {
            "id": a.member.id,
            "firstName": a.member.firstName,
            "lastName": a.member.lastName,
            "photoUrl": a.member.photoUrl,
        },
        "category": {
            "id": a.category.id,
            "name": a.category.name,
            "discipline": {"name": a.category.discipline.name},
        },
    }


def transaction(t: models.Transaction) -> dict:
    return {
        "id": t.id,
        "type": t.type,
        "category": t.category,
        "amount": dec(t.amount),
        "description": t.description,
        "date": iso_date(t.date),
        "createdBy": t.createdBy,
        "createdAt": iso(t.createdAt),
        "updatedAt": iso(t.updatedAt),
    }
