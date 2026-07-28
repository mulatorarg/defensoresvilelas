"""Seed inicial.

    python -m app.seed          # config del club + usuario admin (producción)
    python -m app.seed --demo   # además carga disciplinas/noticias/eventos de ejemplo

Variables de entorno (opcionales):
    CLUB_NAME       nombre del club (default: "Mi Club")
    ADMIN_EMAIL     email del admin (default: admin@clubes.local)
    ADMIN_PASSWORD  contraseña del admin (default: admin123 — cambiar en producción)
"""
import os
import sys
from datetime import timedelta
from decimal import Decimal

from sqlalchemy import select

from . import models
from .database import SessionLocal
from .ids import new_id
from .models import utcnow
from .security import hash_password

# Cada categoría se crea en versión Masculino y Femenino
DEMO_DISCIPLINES = [
    ("Fútbol", "⚽", "Escuela de fútbol infantil, juveniles y primera división.", [
        ("Escuelita (5-8)", 5, 8, "Lun y Mié 18:00"),
        ("Sub-13", 9, 13, "Mar y Jue 18:30"),
        ("Sub-17", 14, 17, "Mar y Jue 20:00"),
        ("Primera", 18, None, "Lun, Mié y Vie 20:30"),
    ]),
    ("Básquet", "🏀", "Formativas y equipo de primera en la liga local.", [
        ("Mini (8-12)", 8, 12, "Lun y Mié 17:30"),
        ("Juveniles", 13, 17, "Mar y Jue 19:00"),
    ]),
    ("Vóley", "🏐", "Vóley masculino y femenino, todas las edades.", [
        ("Iniciación", 8, 12, "Sáb 10:00"),
        ("Mayores", 16, None, "Mar y Jue 21:00"),
    ]),
    ("Hockey", "🏑", "Hockey sobre césped masculino y femenino, con torneos federados.", [
        ("Escuelita", 5, 9, "Vie 18:00"),
        ("Sub-14", 10, 14, "Lun y Mié 19:00"),
        ("Primera", 15, None, "Mar y Jue 20:30"),
    ]),
]

GENDERS = [("Masculino", "MALE"), ("Femenino", "FEMALE")]

DEMO_NEWS = [
    ("bienvenidos-al-nuevo-sitio", "Bienvenidos al nuevo sitio del club",
     "Estrenamos nuestra nueva página web, donde vas a encontrar noticias, horarios de disciplinas y toda la info para asociarte."),
    ("inscripciones-abiertas", "Inscripciones abiertas para todas las disciplinas",
     "Ya podés inscribirte en fútbol, básquet, vóley y hockey. Acercate a secretaría o completá el formulario de contacto."),
    ("gran-victoria-de-primera", "Gran victoria de la primera de fútbol",
     "El equipo superó 3 a 1 a su clásico rival y sigue puntero en el torneo local. ¡Gracias a toda la hinchada que acompañó!"),
]

DEMO_EVENTS = [
    ("Peña del club", "Comida, música en vivo y sorteos para recaudar fondos.", 14, "Salón principal"),
    ("Torneo interno de fútbol", "Torneo relámpago para todas las categorías formativas.", 25, "Predio deportivo"),
]

# (nombre, apellido, dni, año_nac, sexo M/F, email)
DEMO_MEMBERS = [
    ("Juan", "Gómez", "30111222", 1990, "M", "juan.gomez@mail.com"),
    ("María", "Fernández", "33222333", 1994, "F", "maria.f@mail.com"),
    ("Carlos", "Benítez", "28999888", 1985, "M", "cbenitez@mail.com"),
    ("Lucía", "Romero", "40111555", 2001, "F", "lu.romero@mail.com"),
    ("Pedro", "Acosta", "45666777", 2008, "M", None),
    ("Sofía", "Martínez", "46777888", 2009, "F", None),
    ("Diego", "López", "47888999", 2011, "M", None),
    ("Valentina", "Sosa", "48999000", 2012, "F", None),
    ("Ramón", "Ojeda", "25444555", 1980, "M", "rojeda@mail.com"),
    ("Camila", "Vera", "42333444", 2003, "F", "cami.vera@mail.com"),
    ("Facundo", "Ayala", "44555666", 2006, "M", None),
    ("Julieta", "Ríos", "43222111", 2004, "F", "juli.rios@mail.com"),
]

DEMO_TRANSACTIONS = [
    ("INCOME", "Buffet", "85000", "Ventas del buffet fin de semana"),
    ("INCOME", "Alquiler de cancha", "40000", "Alquiler cancha sintética"),
    ("INCOME", "Peña", "120000", "Recaudación peña del club"),
    ("EXPENSE", "Servicios", "35000", "Luz y agua del predio"),
    ("EXPENSE", "Árbitros", "28000", "Arbitrajes fecha local"),
    ("EXPENSE", "Mantenimiento", "18000", "Corte de césped y cal"),
]


def seed_demo_content(db) -> None:
    """Contenido de ejemplo para la landing (solo si la base está vacía)."""
    if not db.scalar(select(models.Discipline.id)):
        for name, icon, description, categories in DEMO_DISCIPLINES:
            discipline = models.Discipline(
                id=new_id(), name=name, icon=icon, description=description
            )
            db.add(discipline)
            db.flush()
            for cat_name, age_from, age_to, schedule in categories:
                for gender_label, gender in GENDERS:
                    db.add(models.Category(
                        id=new_id(), disciplineId=discipline.id,
                        name=f"{cat_name} {gender_label}",
                        ageFrom=age_from, ageTo=age_to, gender=gender,
                        schedule=schedule,
                    ))

    if not db.scalar(select(models.News.id)):
        now = utcnow()
        for i, (slug, title, excerpt) in enumerate(DEMO_NEWS):
            db.add(models.News(
                id=new_id(), slug=slug, title=title, excerpt=excerpt,
                content=excerpt, published=True,
                publishedAt=now - timedelta(days=i * 4),
            ))

    if not db.scalar(select(models.Event.id)):
        now = utcnow()
        for title, description, in_days, location in DEMO_EVENTS:
            db.add(models.Event(
                id=new_id(), title=title, description=description,
                eventDate=now + timedelta(days=in_days), location=location,
            ))

    if not db.scalar(select(models.Member.id)):
        _seed_members_and_activity(db)


def _pick_category(categories, birth_year: int, sex: str):
    """Categoría acorde a la edad y género del socio."""
    age = utcnow().year - birth_year
    gender = "MALE" if sex == "M" else "FEMALE"
    fitting = [
        c for c in categories
        if c.gender == gender
        and (c.ageFrom is None or age >= c.ageFrom)
        and (c.ageTo is None or age <= c.ageTo)
    ]
    return fitting[0] if fitting else None


def _seed_members_and_activity(db) -> None:
    now = utcnow()
    period = f"{now.year}-{now.month:02d}"
    categories = db.scalars(select(models.Category)).all()

    fee_type = db.scalar(select(models.FeeType).where(models.FeeType.name == "Cuota social"))
    if not fee_type:
        fee_type = models.FeeType(id=new_id(), name="Cuota social")
        db.add(fee_type)
        db.flush()

    members = []
    for i, (first, last, dni, birth_year, sex, email) in enumerate(DEMO_MEMBERS):
        member = models.Member(
            id=new_id(),
            memberNumber=str(i + 1).zfill(5),
            firstName=first,
            lastName=last,
            dni=dni,
            email=email,
            phone=f"+54 9 362 4{100000 + i * 731}",
            birthDate=now.replace(year=birth_year, month=3 + (i % 9), day=1 + (i * 2) % 27,
                                  hour=0, minute=0, second=0, microsecond=0),
            status="ACTIVE",
        )
        db.add(member)
        db.flush()
        members.append((member, birth_year, sex))

        category = _pick_category(categories, birth_year, sex)
        if category:
            db.add(models.Enrollment(
                id=new_id(), memberId=member.id, categoryId=category.id, status="ACTIVE",
            ))
            db.flush()

            # Asistencias de las últimas 2 semanas (lunes/miércoles)
            for back in (1, 3, 8, 10):
                db.add(models.Attendance(
                    id=new_id(),
                    categoryId=category.id,
                    memberId=member.id,
                    date=(now - timedelta(days=back)).date(),
                    present=(i + back) % 4 != 0,
                ))

        # Cuota del mes: 60% pagas, resto pendientes, una parcial
        amount = Decimal("12000")
        fee = models.Fee(
            id=new_id(), memberId=member.id, feeTypeId=fee_type.id,
            categoryId=category.id if category else None,
            period=period, amount=amount, paidAmount=Decimal("0"), status="PENDING",
        )
        db.add(fee)
        db.flush()

        if i % 5 == 3:  # parcial
            paid = Decimal("6000")
            db.add(models.Payment(
                id=new_id(), memberId=member.id, feeId=fee.id, amount=paid,
                method="CASH", status="COMPLETED",
                paidAt=now - timedelta(days=i % 6),
            ))
            fee.paidAmount = paid
            fee.status = "PARTIALLY_PAID"
        elif i % 5 != 4:  # pagas
            db.add(models.Payment(
                id=new_id(), memberId=member.id, feeId=fee.id, amount=amount,
                method="CASH" if i % 2 == 0 else "TRANSFER", status="COMPLETED",
                paidAt=now - timedelta(days=i % 10),
            ))
            fee.paidAmount = amount
            fee.status = "PAID"

    # Movimientos de caja del mes
    for i, (tx_type, category_name, amount, description) in enumerate(DEMO_TRANSACTIONS):
        db.add(models.Transaction(
            id=new_id(), type=tx_type, category=category_name,
            amount=Decimal(amount), description=description,
            date=(now - timedelta(days=2 + i * 3)).date(),
        ))


def main() -> None:
    demo = "--demo" in sys.argv or os.getenv("SEED_DEMO") == "1"
    club_name = os.getenv("CLUB_NAME", "Club Atlético Defensores de Vilelas")
    admin_email = os.getenv("ADMIN_EMAIL", "admin@clubes.local")
    admin_password = os.getenv("ADMIN_PASSWORD", "admin123")

    db = SessionLocal()
    try:
        config = db.get(models.ClubConfig, "club")
        if not config:
            db.add(models.ClubConfig(
                id="club",
                name=club_name,
                logoUrl="/escudo.svg",
                primaryColor="#08a757",
                secondaryColor="#056e3d",
                monthlyFee=Decimal("12000"),
            ))

        user = db.scalar(
            select(models.User).where(models.User.email == admin_email)
        )
        if not user:
            db.add(models.User(
                id=new_id(),
                email=admin_email,
                passwordHash=hash_password(admin_password),
                firstName="Admin",
                lastName=club_name,
                role="ADMIN",
            ))

        if demo:
            seed_demo_content(db)

        db.commit()
        print("Seed completado:")
        print(f"  Club: {club_name}")
        print(f"  Usuario admin: {admin_email} (rol ADMIN)")
        if demo:
            print("  Contenido demo: disciplinas, noticias, eventos, 12 socios con")
            print("  inscripciones, asistencias, cuotas (pagas/pendientes) y caja")
        if admin_password == "admin123":
            print("  ADVERTENCIA: contraseña por defecto. Cambiala en producción (ADMIN_PASSWORD).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
