"""Intento: referencia temporal, cambio de tempo y audio sin procesar

tempo_medido_bpm, modo_metronomo, tempo_elegido_bpm, cuenta_para_tarea y motivo_no_cuenta ya
existían. Los intentos anteriores quedan con null: no se registraron.

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | Sequence[str] | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ESQUEMA = "app"


def upgrade() -> None:
    op.add_column("intento", sa.Column("referencia_temporal", sa.String(16)), schema=ESQUEMA)
    op.add_column("intento", sa.Column("cambio_tempo_pct", sa.Float), schema=ESQUEMA)
    op.add_column("intento", sa.Column("audio_sin_procesar", sa.Boolean), schema=ESQUEMA)
    op.create_check_constraint(
        "ck_intento_referencia_temporal",
        "intento",
        "referencia_temporal IN ('tempo_elegido', 'tempo_inicial')",
        schema=ESQUEMA,
    )


def downgrade() -> None:
    op.drop_constraint("ck_intento_referencia_temporal", "intento", schema=ESQUEMA)
    for columna in ("audio_sin_procesar", "cambio_tempo_pct", "referencia_temporal"):
        op.drop_column("intento", columna, schema=ESQUEMA)
