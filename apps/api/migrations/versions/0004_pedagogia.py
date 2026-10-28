"""Pedagogía: tarea y observación

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ESQUEMA = "app"


def _fk(tabla: str, **kw) -> sa.ForeignKey:
    return sa.ForeignKey(f"{ESQUEMA}.{tabla}.id", **kw)


def upgrade() -> None:
    op.create_table(
        "tarea",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("institucion_id", sa.Integer, _fk("institucion"), nullable=False),
        sa.Column("docente_id", sa.Integer, _fk("usuario"), nullable=False),
        sa.Column("estudiante_id", sa.Integer, _fk("usuario", ondelete="CASCADE"), nullable=False),
        sa.Column("ejercicio_id", sa.Integer, _fk("ejercicio"), nullable=False),
        sa.Column("manos", sa.String(8), nullable=False),
        sa.Column("tempo_min_bpm", sa.Integer, nullable=False),
        sa.Column("tempo_max_bpm", sa.Integer, nullable=False),
        sa.Column("repeticiones_por_dia", sa.Integer, nullable=False),
        sa.Column("fecha_limite", sa.Date, nullable=False),
        sa.Column("cancelada_en", sa.DateTime(timezone=True)),
        sa.Column(
            "creada_en", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "actualizada_en",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("tempo_min_bpm <= tempo_max_bpm", name="tempo_ordenado"),
        sa.CheckConstraint("tempo_min_bpm BETWEEN 60 AND 75", name="tempo_min_prm02"),
        sa.CheckConstraint("tempo_max_bpm BETWEEN 60 AND 75", name="tempo_max_prm02"),
        sa.CheckConstraint("repeticiones_por_dia BETWEEN 1 AND 20", name="repeticiones_prm20"),
        sa.CheckConstraint("manos IN ('MI', 'MD', 'juntas')", name="manos_validas"),
        schema=ESQUEMA,
    )
    op.create_index(
        "ix_tarea_estudiante_plazo",
        "tarea",
        ["estudiante_id", "fecha_limite"],
        schema=ESQUEMA,
        postgresql_where=sa.text("cancelada_en IS NULL"),
    )
    op.create_table(
        "observacion",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("docente_id", sa.Integer, _fk("usuario"), nullable=False),
        sa.Column("estudiante_id", sa.Integer, _fk("usuario", ondelete="CASCADE"), nullable=False),
        sa.Column("tarea_id", sa.Integer, _fk("tarea", ondelete="CASCADE")),
        sa.Column("clase_error_id", sa.Integer, _fk("clase_error")),
        sa.Column("texto", sa.Text, nullable=False),
        sa.Column(
            "creada_en", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("char_length(texto) BETWEEN 1 AND 1000", name="texto_longitud"),
        sa.CheckConstraint("tarea_id IS NOT NULL", name="anclada"),
        schema=ESQUEMA,
    )
    op.create_index("ix_observacion_tarea", "observacion", ["tarea_id"], schema=ESQUEMA)


def downgrade() -> None:
    op.drop_table("observacion", schema=ESQUEMA)
    op.drop_table("tarea", schema=ESQUEMA)
