"""rendimiento y funcionales

- Índices para los listados y reportes (propuestas.md 3.1): socios por apellido
  y nombre, cuotas por período, fecha de alta y vencimiento, pagos por fecha,
  asistencias por fecha. asistencias.socio_id ya tiene el índice que InnoDB
  crea para la clave foránea.
- Anulación de cuotas (sección 4): anulada_en, anulada_por, motivo_anulacion.

Cada paso verifica si ya se aplicó (el DDL de MariaDB no es transaccional).

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0003'
down_revision: Union[str, Sequence[str], None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INDEXES = [
    ('ix_socios_apellido_nombre', 'socios', ['apellido', 'nombre']),
    ('ix_cuotas_periodo', 'cuotas', ['periodo']),
    ('ix_cuotas_creado_en', 'cuotas', ['creado_en']),
    ('ix_cuotas_estado_vencimiento', 'cuotas', ['estado', 'fecha_vencimiento']),
    ('ix_pagos_estado_pagado_en', 'pagos', ['estado', 'pagado_en']),
    ('ix_asistencias_fecha', 'asistencias', ['fecha']),
]


def _has_index(table: str, name: str) -> bool:
    return any(i["name"] == name for i in sa.inspect(op.get_bind()).get_indexes(table))


def _has_column(table: str, column: str) -> bool:
    return any(c["name"] == column for c in sa.inspect(op.get_bind()).get_columns(table))


def upgrade() -> None:
    for name, table, columns in INDEXES:
        if not _has_index(table, name):
            op.create_index(name, table, columns, unique=False)

    if not _has_column('cuotas', 'anulada_en'):
        op.add_column('cuotas', sa.Column('anulada_en', sa.DateTime(), nullable=True))
    if not _has_column('cuotas', 'anulada_por'):
        op.add_column('cuotas', sa.Column('anulada_por', sa.String(length=191), nullable=True))
    if not _has_column('cuotas', 'motivo_anulacion'):
        op.add_column('cuotas', sa.Column('motivo_anulacion', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('cuotas', 'motivo_anulacion')
    op.drop_column('cuotas', 'anulada_por')
    op.drop_column('cuotas', 'anulada_en')
    for name, table, _ in reversed(INDEXES):
        op.drop_index(name, table_name=table)
