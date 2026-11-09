"""Asignación docente–estudiante con vigencia

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ESQUEMA = "app"


def upgrade() -> None:
    op.create_table(
        "asignacion_docente",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "institucion_id", sa.Integer, sa.ForeignKey(f"{ESQUEMA}.institucion.id"), nullable=False
        ),
        sa.Column(
            "docente_id",
            sa.Integer,
            sa.ForeignKey(f"{ESQUEMA}.usuario.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "estudiante_id",
            sa.Integer,
            sa.ForeignKey(f"{ESQUEMA}.usuario.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("desde", sa.Date, nullable=False),
        sa.Column("hasta", sa.Date),
        schema=ESQUEMA,
    )
    op.create_index(
        "ix_asignacion_docente_vigente",
        "asignacion_docente",
        ["docente_id"],
        schema=ESQUEMA,
        postgresql_where=sa.text("hasta IS NULL"),
    )


def downgrade() -> None:
    op.drop_table("asignacion_docente", schema=ESQUEMA)
