"""Intentos: intento y diagnostico (sin video, audio ni puntos de la mano)

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ESQUEMA = "app"


def _fk(tabla: str, **kw) -> sa.ForeignKey:
    return sa.ForeignKey(f"{ESQUEMA}.{tabla}.id", **kw)


def upgrade() -> None:
    op.create_table(
        "intento",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("client_uuid", postgresql.UUID(as_uuid=False), nullable=False, unique=True),
        sa.Column("estudiante_id", sa.Integer, _fk("usuario", ondelete="CASCADE"), nullable=False),
        sa.Column("version_ejercicio_id", sa.Integer, _fk("version_ejercicio"), nullable=False),
        sa.Column("tarea_id", sa.Integer, _fk("tarea", ondelete="SET NULL")),
        sa.Column("referencia_id", sa.Integer),
        sa.Column("conjunto_reglas_id", sa.Integer),
        sa.Column("modelo_clasificador_id", sa.Integer),
        sa.Column("version_nucleo", sa.String(32), nullable=False),
        sa.Column("version_modelo_mano", sa.String(64), nullable=False),
        sa.Column("instrumento", sa.String(16), nullable=False),
        sa.Column("manos", sa.String(8), nullable=False),
        sa.Column("clase_dispositivo", sa.String(40), nullable=False),
        sa.Column("modo", sa.String(2), nullable=False),
        sa.Column("modo_metronomo", sa.String(4)),
        sa.Column("tempo_elegido_bpm", sa.Integer),
        sa.Column("tempo_medido_bpm", sa.Float),
        sa.Column("estado", sa.String(16), nullable=False),
        sa.Column("motivo_no_evaluable", sa.String(120)),
        sa.Column("cuenta_para_tarea", sa.Boolean, nullable=False),
        sa.Column("motivo_no_cuenta", sa.String(120)),
        sa.Column("iniciado_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "recibido_en", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("duracion_ms", sa.Integer, nullable=False),
        sa.Column("pct_eventos_evaluables", sa.Float),
        sa.Column("pct_digitacion_correcta", sa.Float),
        sa.Column("eventos", postgresql.JSONB, nullable=False),
        schema=ESQUEMA,
    )
    op.create_index(
        "ix_intento_estudiante_fecha",
        "intento",
        ["estudiante_id", sa.text("iniciado_en DESC")],
        schema=ESQUEMA,
    )
    op.create_index(
        "ix_intento_tarea_cuenta",
        "intento",
        ["tarea_id", "iniciado_en"],
        schema=ESQUEMA,
        postgresql_where=sa.text("cuenta_para_tarea"),
    )
    op.create_table(
        "diagnostico",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("intento_id", sa.Integer, _fk("intento", ondelete="CASCADE"), nullable=False),
        sa.Column("clase_error_id", sa.Integer, _fk("clase_error"), nullable=False),
        sa.Column("indicador_id", sa.Integer),
        sa.Column("origen", sa.String(16), nullable=False),
        sa.Column("version_origen", sa.String(32), nullable=False),
        sa.Column("eventos_evidencia", postgresql.ARRAY(sa.Integer), nullable=False),
        sa.Column("confianza", sa.Float),
        schema=ESQUEMA,
    )


def downgrade() -> None:
    op.drop_table("diagnostico", schema=ESQUEMA)
    op.drop_table("intento", schema=ESQUEMA)
