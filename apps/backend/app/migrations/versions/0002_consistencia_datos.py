"""consistencia de datos

- Uniques que respaldan la lógica (propuestas.md 2.2):
  * pagos: un pago de Mercado Pago por referencia (columna generada referencia_mp).
  * cuotas: una cuota por socio, período, tipo y categoría (claves generadas con
    COALESCE porque tipo y categoría pueden ser NULL).
  * inscripciones: una sola inscripción ACTIVA por socio y categoría (columna
    generada activa); reemplaza al unique (socio_id, categoria_id, estado) que
    impedía dar de baja dos veces.
- Anulación de movimientos de caja en lugar de borrado (2.5).

Si la base tiene duplicados que impiden crear un unique, la migración se
detiene con el detalle: no borra datos por su cuenta. En MariaDB el DDL no es
transaccional, así que cada paso verifica si ya se aplicó: después de resolver
el problema se vuelve a correr y sigue desde donde quedó.

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0002'
down_revision: Union[str, Sequence[str], None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _ensure_no_duplicates(description: str, query: str) -> None:
    rows = op.get_bind().execute(sa.text(query)).fetchall()
    if rows:
        detail = "\n".join(f"  {tuple(r)}" for r in rows[:20])
        raise RuntimeError(
            f"No se puede crear el unique de {description}: hay {len(rows)} grupo(s) "
            f"duplicado(s). Resolverlos a mano y volver a correr la migración:\n{detail}"
        )


def _unique_name(table: str, columns: list[str]) -> str | None:
    for uq in sa.inspect(op.get_bind()).get_unique_constraints(table):
        if uq["column_names"] == columns:
            return uq["name"]
    return None


def _has_column(table: str, column: str) -> bool:
    return any(c["name"] == column for c in sa.inspect(op.get_bind()).get_columns(table))


def _has_unique(table: str, name: str) -> bool:
    return any(uq["name"] == name for uq in sa.inspect(op.get_bind()).get_unique_constraints(table))


def _add_column(table: str, column: sa.Column) -> None:
    if not _has_column(table, column.name):
        op.add_column(table, column)


def _create_unique(name: str, table: str, columns: list[str]) -> None:
    if not _has_unique(table, name):
        op.create_unique_constraint(name, table, columns)


def upgrade() -> None:
    # --- 2.5 Anulación de movimientos de caja
    _add_column('transacciones', sa.Column('estado', sa.String(length=32), server_default='ACTIVE', nullable=False))
    _add_column('transacciones', sa.Column('anulada_en', sa.DateTime(), nullable=True))
    _add_column('transacciones', sa.Column('anulada_por', sa.String(length=191), nullable=True))
    _add_column('transacciones', sa.Column('motivo_anulacion', sa.Text(), nullable=True))

    # --- 2.2 Pagos de Mercado Pago únicos por referencia
    _ensure_no_duplicates(
        "pagos de Mercado Pago (metodo, referencia)",
        "SELECT referencia, COUNT(*) FROM pagos WHERE metodo = 'MERCADO_PAGO' "
        "AND referencia IS NOT NULL GROUP BY referencia HAVING COUNT(*) > 1",
    )
    _add_column('pagos', sa.Column(
        'referencia_mp', sa.String(length=191),
        sa.Computed("CASE WHEN metodo = 'MERCADO_PAGO' THEN referencia END", persisted=True),
        nullable=True,
    ))
    _create_unique('uq_pagos_referencia_mp', 'pagos', ['referencia_mp'])

    # --- 2.2 Cuotas únicas por socio, período, tipo y categoría
    _ensure_no_duplicates(
        "cuotas (socio, período, tipo, categoría)",
        "SELECT socio_id, periodo, tipo_cuota_id, categoria_id, COUNT(*) FROM cuotas "
        "GROUP BY socio_id, periodo, COALESCE(tipo_cuota_id, ''), COALESCE(categoria_id, '') "
        "HAVING COUNT(*) > 1",
    )
    _add_column('cuotas', sa.Column(
        'tipo_clave', sa.String(length=191),
        sa.Computed("COALESCE(tipo_cuota_id, '')", persisted=True),
        nullable=True,
    ))
    _add_column('cuotas', sa.Column(
        'categoria_clave', sa.String(length=191),
        sa.Computed("COALESCE(categoria_id, '')", persisted=True),
        nullable=True,
    ))
    _create_unique('uq_cuotas_periodo', 'cuotas', ['socio_id', 'periodo', 'tipo_clave', 'categoria_clave'])

    # --- 2.2 Una inscripción activa por socio y categoría
    _ensure_no_duplicates(
        "inscripciones activas (socio, categoría)",
        "SELECT socio_id, categoria_id, COUNT(*) FROM inscripciones WHERE estado = 'ACTIVE' "
        "GROUP BY socio_id, categoria_id HAVING COUNT(*) > 1",
    )
    _add_column('inscripciones', sa.Column(
        'activa', sa.Integer(),
        sa.Computed("CASE WHEN estado = 'ACTIVE' THEN 1 END", persisted=True),
        nullable=True,
    ))
    # Primero el unique nuevo: empieza por socio_id y sigue sirviendo de índice a la FK
    _create_unique('uq_inscripciones_activa', 'inscripciones', ['socio_id', 'categoria_id', 'activa'])
    old = _unique_name('inscripciones', ['socio_id', 'categoria_id', 'estado'])
    if old:
        op.drop_constraint(old, 'inscripciones', type_='unique')


def downgrade() -> None:
    op.create_unique_constraint(
        'socio_id', 'inscripciones', ['socio_id', 'categoria_id', 'estado']
    )
    op.drop_constraint('uq_inscripciones_activa', 'inscripciones', type_='unique')
    op.drop_column('inscripciones', 'activa')

    op.drop_constraint('uq_cuotas_periodo', 'cuotas', type_='unique')
    op.drop_column('cuotas', 'categoria_clave')
    op.drop_column('cuotas', 'tipo_clave')

    op.drop_constraint('uq_pagos_referencia_mp', 'pagos', type_='unique')
    op.drop_column('pagos', 'referencia_mp')

    op.drop_column('transacciones', 'motivo_anulacion')
    op.drop_column('transacciones', 'anulada_por')
    op.drop_column('transacciones', 'anulada_en')
    op.drop_column('transacciones', 'estado')
