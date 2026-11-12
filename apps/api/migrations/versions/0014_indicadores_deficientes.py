"""intento.indicadores_deficientes: indicadores que detectaron las reglas (HU-30)

Los intentos anteriores quedan con null: no se diagnosticaron con esta columna.

Revision ID: 0014
Revises: 0013
Create Date: 2026-11-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY

revision: str = "0014"
down_revision: str | Sequence[str] | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ESQUEMA = "app"


def upgrade() -> None:
    op.add_column(
        "intento",
        sa.Column("indicadores_deficientes", ARRAY(sa.String(8))),
        schema=ESQUEMA,
    )


def downgrade() -> None:
    op.drop_column("intento", "indicadores_deficientes", schema=ESQUEMA)
