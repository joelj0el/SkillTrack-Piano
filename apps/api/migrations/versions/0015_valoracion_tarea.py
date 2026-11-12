"""valoracion_tarea: el docente valora la tarea como Lograda o Por repetir (HU-38)

Se guarda el historial; la última valoración decide el estado calculado de la tarea.

Revision ID: 0015
Revises: 0014
Create Date: 2026-11-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: str | Sequence[str] | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ESQUEMA = "app"


def upgrade() -> None:
    op.create_table(
        "valoracion_tarea",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "tarea_id",
            sa.Integer,
            sa.ForeignKey(f"{ESQUEMA}.tarea.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("docente_id", sa.Integer, sa.ForeignKey(f"{ESQUEMA}.usuario.id"), nullable=False),
        sa.Column("valor", sa.String(12), nullable=False),
        sa.Column(
            "observacion_id",
            sa.Integer,
            sa.ForeignKey(f"{ESQUEMA}.observacion.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "creada_en", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("valor IN ('lograda', 'por_repetir')", name="valor_valido"),
        sa.CheckConstraint(
            "valor = 'lograda' OR observacion_id IS NOT NULL", name="por_repetir_con_observacion"
        ),
        schema=ESQUEMA,
    )
    op.create_index(
        "ix_valoracion_tarea_fecha",
        "valoracion_tarea",
        ["tarea_id", "creada_en"],
        schema=ESQUEMA,
    )


def downgrade() -> None:
    op.drop_table("valoracion_tarea", schema=ESQUEMA)
