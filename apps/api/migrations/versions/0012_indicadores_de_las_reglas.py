"""conjunto_reglas.indicadores: los 12 indicadores con su clase, si se evalúan y su mensaje (HU-06)

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0012"
down_revision: str | Sequence[str] | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ESQUEMA = "app"


def upgrade() -> None:
    # Las versiones publicadas antes de este cambio no declaraban indicadores: quedan con {}.
    op.add_column(
        "conjunto_reglas",
        sa.Column("indicadores", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        schema=ESQUEMA,
    )
    op.alter_column("conjunto_reglas", "indicadores", server_default=None, schema=ESQUEMA)


def downgrade() -> None:
    op.drop_column("conjunto_reglas", "indicadores", schema=ESQUEMA)
