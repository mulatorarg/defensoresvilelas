"""esquema base

Esquema completo al momento de adoptar Alembic (incluye los cambios de
seguridad: PIN del socio, version_token, auditoría, credenciales MP en TEXT).

También sirve de puente para las bases creadas antes con `create_all`
(producción y desarrollo): crea solo las tablas que faltan y agrega las
columnas que esas bases pueden no tener. En una base vacía equivale a crear
todo desde cero.

Revision ID: 0001
Revises: 
Create Date: 2026-09-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision: str = '0001'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector():
    return sa.inspect(op.get_bind())


def _missing_table(name: str) -> bool:
    return not _inspector().has_table(name)


def _columns(table: str) -> dict:
    return {c["name"]: c for c in _inspector().get_columns(table)}


def _bridge_legacy_columns() -> None:
    """Columnas agregadas por la revisión de seguridad a tablas preexistentes."""
    socios = _columns("socios")
    if "hash_pin" not in socios:
        op.add_column("socios", sa.Column("hash_pin", sa.String(length=191), nullable=True))
    if "pin_intentos_fallidos" not in socios:
        op.add_column("socios", sa.Column("pin_intentos_fallidos", sa.Integer(), server_default="0", nullable=False))
    if "pin_bloqueado_hasta" not in socios:
        op.add_column("socios", sa.Column("pin_bloqueado_hasta", sa.DateTime(), nullable=True))
    if "version_token" not in socios:
        op.add_column("socios", sa.Column("version_token", sa.Integer(), server_default="0", nullable=False))

    if "version_token" not in _columns("usuarios"):
        op.add_column("usuarios", sa.Column("version_token", sa.Integer(), server_default="0", nullable=False))

    club = _columns("configuracion_club")
    for column in ("mp_access_token", "mp_webhook_secret"):
        if "CHAR" in str(club[column]["type"]).upper():
            op.alter_column("configuracion_club", column, type_=sa.Text(), existing_nullable=True)


def upgrade() -> None:
    if _missing_table('auditoria'):
        op.create_table('auditoria',
        sa.Column('id', sa.String(length=191), nullable=False),
        sa.Column('usuario_id', sa.String(length=191), nullable=True),
        sa.Column('usuario_correo', sa.String(length=191), nullable=True),
        sa.Column('accion', sa.String(length=191), nullable=False),
        sa.Column('entidad', sa.String(length=191), nullable=False),
        sa.Column('entidad_id', sa.String(length=191), nullable=True),
        sa.Column('detalle', sa.Text(), nullable=True),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_auditoria_entidad', 'auditoria', ['entidad', 'entidad_id'], unique=False)
        op.create_index('ix_auditoria_fecha', 'auditoria', ['creado_en'], unique=False)
    if _missing_table('configuracion_club'):
        op.create_table('configuracion_club',
        sa.Column('id', sa.String(length=191), nullable=False),
        sa.Column('nombre', sa.String(length=191), nullable=False),
        sa.Column('nombre_legal', sa.String(length=191), nullable=True),
        sa.Column('documento', sa.String(length=191), nullable=True),
        sa.Column('url_logo', sa.String(length=191), nullable=True),
        sa.Column('color_primario', sa.String(length=191), nullable=True),
        sa.Column('color_secundario', sa.String(length=191), nullable=True),
        sa.Column('direccion', sa.String(length=191), nullable=True),
        sa.Column('telefono', sa.String(length=191), nullable=True),
        sa.Column('correo', sa.String(length=191), nullable=True),
        sa.Column('whatsapp', sa.String(length=191), nullable=True),
        sa.Column('instagram', sa.String(length=191), nullable=True),
        sa.Column('facebook', sa.String(length=191), nullable=True),
        sa.Column('sitio_web', sa.String(length=191), nullable=True),
        sa.Column('monto_cuota_social', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('mp_access_token', sa.Text(), nullable=True),
        sa.Column('mp_webhook_secret', sa.Text(), nullable=True),
        sa.Column('configuracion_extra', sa.Text(), nullable=True),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.Column('actualizado_en', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
        )
    if _missing_table('disciplinas'):
        op.create_table('disciplinas',
        sa.Column('id', sa.String(length=191), nullable=False),
        sa.Column('nombre', sa.String(length=191), nullable=False),
        sa.Column('descripcion', sa.Text(), nullable=True),
        sa.Column('icono', sa.String(length=191), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.Column('actualizado_en', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
        )
    if _missing_table('eventos'):
        op.create_table('eventos',
        sa.Column('id', sa.String(length=191), nullable=False),
        sa.Column('titulo', sa.String(length=191), nullable=False),
        sa.Column('descripcion', sa.Text(), nullable=True),
        sa.Column('fecha_evento', sa.DateTime(), nullable=False),
        sa.Column('lugar', sa.String(length=191), nullable=True),
        sa.Column('publico', sa.Boolean(), nullable=False),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.Column('actualizado_en', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_eventos_fecha', 'eventos', ['fecha_evento'], unique=False)
    if _missing_table('noticias'):
        op.create_table('noticias',
        sa.Column('id', sa.String(length=191), nullable=False),
        sa.Column('titulo', sa.String(length=191), nullable=False),
        sa.Column('slug', sa.String(length=191), nullable=False),
        sa.Column('resumen', sa.Text(), nullable=True),
        sa.Column('contenido', mysql.LONGTEXT(), nullable=True),
        sa.Column('url_imagen', sa.String(length=191), nullable=True),
        sa.Column('publicada', sa.Boolean(), nullable=False),
        sa.Column('publicada_en', sa.DateTime(), nullable=True),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.Column('actualizado_en', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug')
        )
        op.create_index('ix_noticias_publicada', 'noticias', ['publicada'], unique=False)
    if _missing_table('socios'):
        op.create_table('socios',
        sa.Column('id', sa.String(length=191), nullable=False),
        sa.Column('numero_socio', sa.String(length=191), nullable=True),
        sa.Column('nombre', sa.String(length=191), nullable=False),
        sa.Column('apellido', sa.String(length=191), nullable=False),
        sa.Column('dni', sa.String(length=191), nullable=False),
        sa.Column('correo', sa.String(length=191), nullable=True),
        sa.Column('telefono', sa.String(length=191), nullable=True),
        sa.Column('direccion', sa.String(length=191), nullable=True),
        sa.Column('fecha_nacimiento', sa.DateTime(), nullable=True),
        sa.Column('url_foto', sa.String(length=191), nullable=True),
        sa.Column('estado', sa.String(length=191), nullable=False),
        sa.Column('notas', sa.Text(), nullable=True),
        sa.Column('hash_pin', sa.String(length=191), nullable=True),
        sa.Column('pin_intentos_fallidos', sa.Integer(), server_default='0', nullable=False),
        sa.Column('pin_bloqueado_hasta', sa.DateTime(), nullable=True),
        sa.Column('version_token', sa.Integer(), server_default='0', nullable=False),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.Column('actualizado_en', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('dni'),
        sa.UniqueConstraint('numero_socio')
        )
        op.create_index('ix_socios_estado', 'socios', ['estado'], unique=False)
    if _missing_table('tipos_cuota'):
        op.create_table('tipos_cuota',
        sa.Column('id', sa.String(length=191), nullable=False),
        sa.Column('nombre', sa.String(length=191), nullable=False),
        sa.Column('descripcion', sa.Text(), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
        )
    if _missing_table('transacciones'):
        op.create_table('transacciones',
        sa.Column('id', sa.String(length=191), nullable=False),
        sa.Column('tipo', sa.String(length=191), nullable=False),
        sa.Column('categoria', sa.String(length=191), nullable=False),
        sa.Column('monto', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('descripcion', sa.Text(), nullable=True),
        sa.Column('fecha', sa.Date(), nullable=False),
        sa.Column('creado_por', sa.String(length=191), nullable=True),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.Column('actualizado_en', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_transacciones_fecha', 'transacciones', ['fecha'], unique=False)
    if _missing_table('usuarios'):
        op.create_table('usuarios',
        sa.Column('id', sa.String(length=191), nullable=False),
        sa.Column('correo', sa.String(length=191), nullable=False),
        sa.Column('hash_contrasena', sa.String(length=191), nullable=False),
        sa.Column('nombre', sa.String(length=191), nullable=False),
        sa.Column('apellido', sa.String(length=191), nullable=False),
        sa.Column('telefono', sa.String(length=191), nullable=True),
        sa.Column('rol', sa.String(length=191), nullable=False),
        sa.Column('activo', sa.Boolean(), nullable=False),
        sa.Column('version_token', sa.Integer(), server_default='0', nullable=False),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.Column('actualizado_en', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('correo')
        )
    if _missing_table('categorias'):
        op.create_table('categorias',
        sa.Column('id', sa.String(length=191), nullable=False),
        sa.Column('disciplina_id', sa.String(length=191), nullable=False),
        sa.Column('nombre', sa.String(length=191), nullable=False),
        sa.Column('edad_desde', sa.Integer(), nullable=True),
        sa.Column('edad_hasta', sa.Integer(), nullable=True),
        sa.Column('genero', sa.String(length=191), nullable=True),
        sa.Column('monto_cuota', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('horario', sa.String(length=191), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.Column('actualizado_en', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['disciplina_id'], ['disciplinas.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
    if _missing_table('perfiles_jugadores'):
        op.create_table('perfiles_jugadores',
        sa.Column('id', sa.String(length=191), nullable=False),
        sa.Column('socio_id', sa.String(length=191), nullable=False),
        sa.Column('posicion', sa.String(length=191), nullable=True),
        sa.Column('numero_camiseta', sa.Integer(), nullable=True),
        sa.Column('id_federacion', sa.String(length=191), nullable=True),
        sa.Column('vencimiento_pase_medico', sa.DateTime(), nullable=True),
        sa.Column('notas', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['socio_id'], ['socios.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('socio_id')
        )
    if _missing_table('asistencias'):
        op.create_table('asistencias',
        sa.Column('id', sa.String(length=191), nullable=False),
        sa.Column('categoria_id', sa.String(length=191), nullable=False),
        sa.Column('socio_id', sa.String(length=191), nullable=False),
        sa.Column('fecha', sa.Date(), nullable=False),
        sa.Column('presente', sa.Boolean(), nullable=False),
        sa.Column('notas', sa.String(length=191), nullable=True),
        sa.Column('creado_por', sa.String(length=191), nullable=True),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['categoria_id'], ['categorias.id'], ),
        sa.ForeignKeyConstraint(['socio_id'], ['socios.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('categoria_id', 'socio_id', 'fecha')
        )
        op.create_index('ix_asistencias_cat_fecha', 'asistencias', ['categoria_id', 'fecha'], unique=False)
    if _missing_table('cuotas'):
        op.create_table('cuotas',
        sa.Column('id', sa.String(length=191), nullable=False),
        sa.Column('socio_id', sa.String(length=191), nullable=False),
        sa.Column('tipo_cuota_id', sa.String(length=191), nullable=True),
        sa.Column('categoria_id', sa.String(length=191), nullable=True),
        sa.Column('periodo', sa.String(length=191), nullable=False),
        sa.Column('monto', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('monto_pagado', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('fecha_vencimiento', sa.DateTime(), nullable=True),
        sa.Column('estado', sa.String(length=191), nullable=False),
        sa.Column('descripcion', sa.Text(), nullable=True),
        sa.Column('referencia_externa', sa.String(length=191), nullable=True),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.Column('actualizado_en', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['categoria_id'], ['categorias.id'], ),
        sa.ForeignKeyConstraint(['socio_id'], ['socios.id'], ),
        sa.ForeignKeyConstraint(['tipo_cuota_id'], ['tipos_cuota.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_cuotas_estado', 'cuotas', ['estado'], unique=False)
        op.create_index('ix_cuotas_socio', 'cuotas', ['socio_id'], unique=False)
    if _missing_table('equipos'):
        op.create_table('equipos',
        sa.Column('id', sa.String(length=191), nullable=False),
        sa.Column('disciplina_id', sa.String(length=191), nullable=False),
        sa.Column('nombre', sa.String(length=191), nullable=False),
        sa.Column('categoria_id', sa.String(length=191), nullable=True),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.Column('actualizado_en', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['categoria_id'], ['categorias.id'], ),
        sa.ForeignKeyConstraint(['disciplina_id'], ['disciplinas.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
    if _missing_table('inscripciones'):
        op.create_table('inscripciones',
        sa.Column('id', sa.String(length=191), nullable=False),
        sa.Column('socio_id', sa.String(length=191), nullable=False),
        sa.Column('categoria_id', sa.String(length=191), nullable=False),
        sa.Column('inscrito_en', sa.DateTime(), nullable=False),
        sa.Column('baja_en', sa.DateTime(), nullable=True),
        sa.Column('estado', sa.String(length=191), nullable=False),
        sa.ForeignKeyConstraint(['categoria_id'], ['categorias.id'], ),
        sa.ForeignKeyConstraint(['socio_id'], ['socios.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('socio_id', 'categoria_id', 'estado')
        )
        op.create_index('ix_inscripciones_categoria', 'inscripciones', ['categoria_id'], unique=False)
    if _missing_table('pagos'):
        op.create_table('pagos',
        sa.Column('id', sa.String(length=191), nullable=False),
        sa.Column('socio_id', sa.String(length=191), nullable=True),
        sa.Column('cuota_id', sa.String(length=191), nullable=True),
        sa.Column('monto', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('metodo', sa.String(length=191), nullable=False),
        sa.Column('estado', sa.String(length=191), nullable=False),
        sa.Column('referencia', sa.String(length=191), nullable=True),
        sa.Column('metadatos', sa.Text(), nullable=True),
        sa.Column('pagado_en', sa.DateTime(), nullable=True),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.Column('actualizado_en', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['cuota_id'], ['cuotas.id'], ),
        sa.ForeignKeyConstraint(['socio_id'], ['socios.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_pagos_cuota', 'pagos', ['cuota_id'], unique=False)
        op.create_index('ix_pagos_estado', 'pagos', ['estado'], unique=False)
    if _missing_table('partidos'):
        op.create_table('partidos',
        sa.Column('id', sa.String(length=191), nullable=False),
        sa.Column('disciplina_id', sa.String(length=191), nullable=False),
        sa.Column('equipo_local_id', sa.String(length=191), nullable=False),
        sa.Column('equipo_visitante_id', sa.String(length=191), nullable=False),
        sa.Column('goles_local', sa.Integer(), nullable=True),
        sa.Column('goles_visitante', sa.Integer(), nullable=True),
        sa.Column('fecha_partido', sa.DateTime(), nullable=False),
        sa.Column('lugar', sa.String(length=191), nullable=True),
        sa.Column('estado', sa.String(length=191), nullable=False),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.Column('actualizado_en', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['disciplina_id'], ['disciplinas.id'], ),
        sa.ForeignKeyConstraint(['equipo_local_id'], ['equipos.id'], ),
        sa.ForeignKeyConstraint(['equipo_visitante_id'], ['equipos.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_partidos_fecha', 'partidos', ['fecha_partido'], unique=False)

    _bridge_legacy_columns()


def downgrade() -> None:
    op.drop_index('ix_partidos_fecha', table_name='partidos')
    op.drop_table('partidos')
    op.drop_index('ix_pagos_estado', table_name='pagos')
    op.drop_index('ix_pagos_cuota', table_name='pagos')
    op.drop_table('pagos')
    op.drop_index('ix_inscripciones_categoria', table_name='inscripciones')
    op.drop_table('inscripciones')
    op.drop_table('equipos')
    op.drop_index('ix_cuotas_socio', table_name='cuotas')
    op.drop_index('ix_cuotas_estado', table_name='cuotas')
    op.drop_table('cuotas')
    op.drop_index('ix_asistencias_cat_fecha', table_name='asistencias')
    op.drop_table('asistencias')
    op.drop_table('perfiles_jugadores')
    op.drop_table('categorias')
    op.drop_table('usuarios')
    op.drop_index('ix_transacciones_fecha', table_name='transacciones')
    op.drop_table('transacciones')
    op.drop_table('tipos_cuota')
    op.drop_index('ix_socios_estado', table_name='socios')
    op.drop_table('socios')
    op.drop_index('ix_noticias_publicada', table_name='noticias')
    op.drop_table('noticias')
    op.drop_index('ix_eventos_fecha', table_name='eventos')
    op.drop_table('eventos')
    op.drop_table('disciplinas')
    op.drop_table('configuracion_club')
    op.drop_index('ix_auditoria_fecha', table_name='auditoria')
    op.drop_index('ix_auditoria_entidad', table_name='auditoria')
    op.drop_table('auditoria')
