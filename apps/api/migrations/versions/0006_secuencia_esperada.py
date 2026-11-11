"""Intento: de dónde salieron las notas esperadas (partitura importada o escala provisional)

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | Sequence[str] | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ESQUEMA = "app"


def upgrade() -> None:
    # Los intentos anteriores usaron la escala provisional: no había partituras importadas.
    op.add_column(
        "intento",
        sa.Column(
            "secuencia_esperada", sa.String(12), nullable=False, server_default="provisional"
        ),
        schema=ESQUEMA,
    )


def downgrade() -> None:
    op.drop_column("intento", "secuencia_esperada", schema=ESQUEMA)
