"""intento.calificacion: nivel de cada variable (PRM-22) con las reglas vigentes (HU-28)

Los intentos anteriores quedan con null: no se calificaron.

Revision ID: 0013
Revises: 0012
Create Date: 2026-11-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0013"
down_revision: str | Sequence[str] | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ESQUEMA = "app"


def upgrade() -> None:
    op.add_column("intento", sa.Column("calificacion", JSONB), schema=ESQUEMA)


def downgrade() -> None:
    op.drop_column("intento", "calificacion", schema=ESQUEMA)
