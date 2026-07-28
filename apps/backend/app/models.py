"""Modelos SQLAlchemy — sistema single-club (una instancia por club).

Tablas y columnas en español; atributos Python en inglés para mantener
el contrato JSON camelCase con el frontend.
"""
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from .ids import new_id


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


# ---------------------------
# Configuración del club (fila única)
# ---------------------------


class ClubConfig(Base):
    __tablename__ = "configuracion_club"

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default="club")
    name: Mapped[str] = mapped_column("nombre", String(191), default="Mi Club")
    legalName: Mapped[str | None] = mapped_column("nombre_legal", String(191))
    document: Mapped[str | None] = mapped_column("documento", String(191))
    logoUrl: Mapped[str | None] = mapped_column("url_logo", String(191))
    primaryColor: Mapped[str | None] = mapped_column("color_primario", String(191), default="#08a757")
    secondaryColor: Mapped[str | None] = mapped_column("color_secundario", String(191), default="#056e3d")
    address: Mapped[str | None] = mapped_column("direccion", String(191))
    phone: Mapped[str | None] = mapped_column("telefono", String(191))
    email: Mapped[str | None] = mapped_column("correo", String(191))
    whatsapp: Mapped[str | None] = mapped_column(String(191))
    instagram: Mapped[str | None] = mapped_column(String(191))
    facebook: Mapped[str | None] = mapped_column(String(191))
    website: Mapped[str | None] = mapped_column("sitio_web", String(191))
    monthlyFee: Mapped[Decimal | None] = mapped_column("monto_cuota_social", Numeric(10, 2))
    mpAccessToken: Mapped[str | None] = mapped_column("mp_access_token", String(255))
    mpWebhookSecret: Mapped[str | None] = mapped_column("mp_webhook_secret", String(255))
    settings: Mapped[str | None] = mapped_column("configuracion_extra", Text, default="{}")
    createdAt: Mapped[datetime] = mapped_column("creado_en", DateTime(3), default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column("actualizado_en", DateTime(3), default=utcnow, onupdate=utcnow)


# ---------------------------
# Usuarios del sistema (staff/admin/profesores)
# ---------------------------


class User(Base):
    __tablename__ = "usuarios"

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column("correo", String(191), unique=True)
    passwordHash: Mapped[str] = mapped_column("hash_contrasena", String(191))
    firstName: Mapped[str] = mapped_column("nombre", String(191))
    lastName: Mapped[str] = mapped_column("apellido", String(191))
    phone: Mapped[str | None] = mapped_column("telefono", String(191))
    role: Mapped[str] = mapped_column("rol", String(191), default="STAFF")
    isActive: Mapped[bool] = mapped_column("activo", Boolean, default=True)
    createdAt: Mapped[datetime] = mapped_column("creado_en", DateTime(3), default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column("actualizado_en", DateTime(3), default=utcnow, onupdate=utcnow)


# ---------------------------
# Socios / Jugadores
# ---------------------------


class Member(Base):
    __tablename__ = "socios"
    __table_args__ = (Index("ix_socios_estado", "estado"),)

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=new_id)
    memberNumber: Mapped[str | None] = mapped_column("numero_socio", String(191), unique=True)
    firstName: Mapped[str] = mapped_column("nombre", String(191))
    lastName: Mapped[str] = mapped_column("apellido", String(191))
    dni: Mapped[str] = mapped_column(String(191), unique=True)
    email: Mapped[str | None] = mapped_column("correo", String(191))
    phone: Mapped[str | None] = mapped_column("telefono", String(191))
    address: Mapped[str | None] = mapped_column("direccion", String(191))
    birthDate: Mapped[datetime | None] = mapped_column("fecha_nacimiento", DateTime(3))
    photoUrl: Mapped[str | None] = mapped_column("url_foto", String(191))
    status: Mapped[str] = mapped_column("estado", String(191), default="ACTIVE")
    notes: Mapped[str | None] = mapped_column("notas", Text)
    createdAt: Mapped[datetime] = mapped_column("creado_en", DateTime(3), default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column("actualizado_en", DateTime(3), default=utcnow, onupdate=utcnow)

    player: Mapped["PlayerProfile | None"] = relationship(back_populates="member", uselist=False)
    enrollments: Mapped[list["Enrollment"]] = relationship(back_populates="member")


class PlayerProfile(Base):
    __tablename__ = "perfiles_jugadores"

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=new_id)
    memberId: Mapped[str] = mapped_column("socio_id", String(191), ForeignKey("socios.id"), unique=True)
    position: Mapped[str | None] = mapped_column("posicion", String(191))
    jerseyNumber: Mapped[int | None] = mapped_column("numero_camiseta", Integer)
    federationId: Mapped[str | None] = mapped_column("id_federacion", String(191))
    medicalPassDue: Mapped[datetime | None] = mapped_column("vencimiento_pase_medico", DateTime(3))
    notes: Mapped[str | None] = mapped_column("notas", Text)

    member: Mapped["Member"] = relationship(back_populates="player")


# ---------------------------
# Disciplinas y Categorías
# ---------------------------


class Discipline(Base):
    __tablename__ = "disciplinas"

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column("nombre", String(191))
    description: Mapped[str | None] = mapped_column("descripcion", Text)
    icon: Mapped[str | None] = mapped_column("icono", String(191))
    isActive: Mapped[bool] = mapped_column("activo", Boolean, default=True)
    createdAt: Mapped[datetime] = mapped_column("creado_en", DateTime(3), default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column("actualizado_en", DateTime(3), default=utcnow, onupdate=utcnow)

    categories: Mapped[list["Category"]] = relationship(back_populates="discipline")


class Category(Base):
    __tablename__ = "categorias"

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=new_id)
    disciplineId: Mapped[str] = mapped_column("disciplina_id", String(191), ForeignKey("disciplinas.id"))
    name: Mapped[str] = mapped_column("nombre", String(191))
    ageFrom: Mapped[int | None] = mapped_column("edad_desde", Integer)
    ageTo: Mapped[int | None] = mapped_column("edad_hasta", Integer)
    gender: Mapped[str | None] = mapped_column("genero", String(191), default="MIXED")
    feeAmount: Mapped[Decimal | None] = mapped_column("monto_cuota", Numeric(10, 2))
    schedule: Mapped[str | None] = mapped_column("horario", String(191))
    isActive: Mapped[bool] = mapped_column("activo", Boolean, default=True)
    createdAt: Mapped[datetime] = mapped_column("creado_en", DateTime(3), default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column("actualizado_en", DateTime(3), default=utcnow, onupdate=utcnow)

    discipline: Mapped["Discipline"] = relationship(back_populates="categories")
    enrollments: Mapped[list["Enrollment"]] = relationship(back_populates="category")


class Enrollment(Base):
    __tablename__ = "inscripciones"
    __table_args__ = (
        UniqueConstraint("socio_id", "categoria_id", "estado"),
        Index("ix_inscripciones_categoria", "categoria_id"),
    )

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=new_id)
    memberId: Mapped[str] = mapped_column("socio_id", String(191), ForeignKey("socios.id"))
    categoryId: Mapped[str] = mapped_column("categoria_id", String(191), ForeignKey("categorias.id"))
    enrolledAt: Mapped[datetime] = mapped_column("inscrito_en", DateTime(3), default=utcnow)
    leftAt: Mapped[datetime | None] = mapped_column("baja_en", DateTime(3))
    status: Mapped[str] = mapped_column("estado", String(191), default="ACTIVE")

    member: Mapped["Member"] = relationship(back_populates="enrollments")
    category: Mapped["Category"] = relationship(back_populates="enrollments")


# ---------------------------
# Cuotas y Pagos
# ---------------------------


class FeeType(Base):
    __tablename__ = "tipos_cuota"

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column("nombre", String(191))
    description: Mapped[str | None] = mapped_column("descripcion", Text)
    isActive: Mapped[bool] = mapped_column("activo", Boolean, default=True)
    createdAt: Mapped[datetime] = mapped_column("creado_en", DateTime(3), default=utcnow)


class Fee(Base):
    __tablename__ = "cuotas"
    __table_args__ = (
        Index("ix_cuotas_socio", "socio_id"),
        Index("ix_cuotas_estado", "estado"),
    )

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=new_id)
    memberId: Mapped[str] = mapped_column("socio_id", String(191), ForeignKey("socios.id"))
    feeTypeId: Mapped[str | None] = mapped_column("tipo_cuota_id", String(191), ForeignKey("tipos_cuota.id"))
    categoryId: Mapped[str | None] = mapped_column("categoria_id", String(191), ForeignKey("categorias.id"))
    period: Mapped[str] = mapped_column("periodo", String(191))
    amount: Mapped[Decimal] = mapped_column("monto", Numeric(10, 2))
    paidAmount: Mapped[Decimal] = mapped_column("monto_pagado", Numeric(10, 2), default=Decimal("0"))
    dueDate: Mapped[datetime | None] = mapped_column("fecha_vencimiento", DateTime(3))
    status: Mapped[str] = mapped_column("estado", String(191), default="PENDING")
    description: Mapped[str | None] = mapped_column("descripcion", Text)
    externalReference: Mapped[str | None] = mapped_column("referencia_externa", String(191))
    createdAt: Mapped[datetime] = mapped_column("creado_en", DateTime(3), default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column("actualizado_en", DateTime(3), default=utcnow, onupdate=utcnow)

    member: Mapped["Member"] = relationship()
    feeType: Mapped["FeeType | None"] = relationship()
    category: Mapped["Category | None"] = relationship()
    payments: Mapped[list["Payment"]] = relationship(back_populates="fee")


class Payment(Base):
    __tablename__ = "pagos"
    __table_args__ = (
        Index("ix_pagos_cuota", "cuota_id"),
        Index("ix_pagos_estado", "estado"),
    )

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=new_id)
    memberId: Mapped[str | None] = mapped_column("socio_id", String(191), ForeignKey("socios.id"))
    feeId: Mapped[str | None] = mapped_column("cuota_id", String(191), ForeignKey("cuotas.id"))
    amount: Mapped[Decimal] = mapped_column("monto", Numeric(10, 2))
    method: Mapped[str] = mapped_column("metodo", String(191))
    status: Mapped[str] = mapped_column("estado", String(191), default="COMPLETED")
    reference: Mapped[str | None] = mapped_column("referencia", String(191))
    metadata_json: Mapped[str | None] = mapped_column("metadatos", Text, default="{}")
    paidAt: Mapped[datetime | None] = mapped_column("pagado_en", DateTime(3), default=utcnow)
    createdAt: Mapped[datetime] = mapped_column("creado_en", DateTime(3), default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column("actualizado_en", DateTime(3), default=utcnow, onupdate=utcnow)

    fee: Mapped["Fee | None"] = relationship(back_populates="payments")
    member: Mapped["Member | None"] = relationship()


# ---------------------------
# Asistencia
# ---------------------------


class Attendance(Base):
    __tablename__ = "asistencias"
    __table_args__ = (
        UniqueConstraint("categoria_id", "socio_id", "fecha"),
        Index("ix_asistencias_cat_fecha", "categoria_id", "fecha"),
    )

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=new_id)
    categoryId: Mapped[str] = mapped_column("categoria_id", String(191), ForeignKey("categorias.id"))
    memberId: Mapped[str] = mapped_column("socio_id", String(191), ForeignKey("socios.id"))
    date: Mapped[date] = mapped_column("fecha", Date)
    present: Mapped[bool] = mapped_column("presente", Boolean, default=True)
    notes: Mapped[str | None] = mapped_column("notas", String(191))
    createdBy: Mapped[str | None] = mapped_column("creado_por", String(191))
    createdAt: Mapped[datetime] = mapped_column("creado_en", DateTime(3), default=utcnow)

    member: Mapped["Member"] = relationship()
    category: Mapped["Category"] = relationship()


# ---------------------------
# Caja / Contabilidad simple
# ---------------------------


class Transaction(Base):
    __tablename__ = "transacciones"
    __table_args__ = (Index("ix_transacciones_fecha", "fecha"),)

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=new_id)
    type: Mapped[str] = mapped_column("tipo", String(191))
    category: Mapped[str] = mapped_column("categoria", String(191))
    amount: Mapped[Decimal] = mapped_column("monto", Numeric(10, 2))
    description: Mapped[str | None] = mapped_column("descripcion", Text)
    date: Mapped[date] = mapped_column("fecha", Date, default=lambda: utcnow().date())
    createdBy: Mapped[str | None] = mapped_column("creado_por", String(191))
    createdAt: Mapped[datetime] = mapped_column("creado_en", DateTime(3), default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column("actualizado_en", DateTime(3), default=utcnow, onupdate=utcnow)


# ---------------------------
# Sitio institucional
# ---------------------------


class News(Base):
    __tablename__ = "noticias"
    __table_args__ = (Index("ix_noticias_publicada", "publicada"),)

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column("titulo", String(191))
    slug: Mapped[str] = mapped_column(String(191), unique=True)
    excerpt: Mapped[str | None] = mapped_column("resumen", Text)
    content: Mapped[str | None] = mapped_column("contenido", LONGTEXT)
    imageUrl: Mapped[str | None] = mapped_column("url_imagen", String(191))
    published: Mapped[bool] = mapped_column("publicada", Boolean, default=False)
    publishedAt: Mapped[datetime | None] = mapped_column("publicada_en", DateTime(3))
    createdAt: Mapped[datetime] = mapped_column("creado_en", DateTime(3), default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column("actualizado_en", DateTime(3), default=utcnow, onupdate=utcnow)


class Event(Base):
    __tablename__ = "eventos"
    __table_args__ = (Index("ix_eventos_fecha", "fecha_evento"),)

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column("titulo", String(191))
    description: Mapped[str | None] = mapped_column("descripcion", Text)
    eventDate: Mapped[datetime] = mapped_column("fecha_evento", DateTime(3))
    location: Mapped[str | None] = mapped_column("lugar", String(191))
    isPublic: Mapped[bool] = mapped_column("publico", Boolean, default=True)
    createdAt: Mapped[datetime] = mapped_column("creado_en", DateTime(3), default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column("actualizado_en", DateTime(3), default=utcnow, onupdate=utcnow)


# ---------------------------
# Partidos / Equipos
# ---------------------------


class Team(Base):
    __tablename__ = "equipos"

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=new_id)
    disciplineId: Mapped[str] = mapped_column("disciplina_id", String(191), ForeignKey("disciplinas.id"))
    name: Mapped[str] = mapped_column("nombre", String(191))
    categoryId: Mapped[str | None] = mapped_column("categoria_id", String(191), ForeignKey("categorias.id"))
    createdAt: Mapped[datetime] = mapped_column("creado_en", DateTime(3), default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column("actualizado_en", DateTime(3), default=utcnow, onupdate=utcnow)

    discipline: Mapped["Discipline"] = relationship()
    category: Mapped["Category | None"] = relationship()


class Match(Base):
    __tablename__ = "partidos"
    __table_args__ = (Index("ix_partidos_fecha", "fecha_partido"),)

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=new_id)
    disciplineId: Mapped[str] = mapped_column("disciplina_id", String(191), ForeignKey("disciplinas.id"))
    homeTeamId: Mapped[str] = mapped_column("equipo_local_id", String(191), ForeignKey("equipos.id"))
    awayTeamId: Mapped[str] = mapped_column("equipo_visitante_id", String(191), ForeignKey("equipos.id"))
    homeScore: Mapped[int | None] = mapped_column("goles_local", Integer)
    awayScore: Mapped[int | None] = mapped_column("goles_visitante", Integer)
    matchDate: Mapped[datetime] = mapped_column("fecha_partido", DateTime(3))
    location: Mapped[str | None] = mapped_column("lugar", String(191))
    status: Mapped[str] = mapped_column("estado", String(191), default="SCHEDULED")
    createdAt: Mapped[datetime] = mapped_column("creado_en", DateTime(3), default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column("actualizado_en", DateTime(3), default=utcnow, onupdate=utcnow)

    homeTeam: Mapped["Team"] = relationship(foreign_keys=[homeTeamId])
    awayTeam: Mapped["Team"] = relationship(foreign_keys=[awayTeamId])
