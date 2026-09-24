"""imágenes propias del club

Foto de portada de la landing (configuracion_club.url_imagen_portada) y foto por
disciplina (disciplinas.url_imagen), para reemplazar las fotos genéricas.

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0004'
down_revision: Union[str, Sequence[str], None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    return any(c["name"] == column for c in sa.inspect(op.get_bind()).get_columns(table))


def upgrade() -> None:
    if not _has_column('configuracion_club', 'url_imagen_portada'):
        op.add_column('configuracion_club', sa.Column('url_imagen_portada', sa.String(length=191), nullable=True))
    if not _has_column('disciplinas', 'url_imagen'):
        op.add_column('disciplinas', sa.Column('url_imagen', sa.String(length=191), nullable=True))


def downgrade() -> None:
    op.drop_column('disciplinas', 'url_imagen')
    op.drop_column('configuracion_club', 'url_imagen_portada')
