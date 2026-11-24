"""registro de compradores y convenios con código (HU-40, ADR-005)

El usuario guarda su teléfono de contacto y el instante en que aceptó los términos y la política
de privacidad. Un convenio con código fija el plan, el precio especial (puede ser 0), los cupos y
el vencimiento; la suscripción que lo usa lo referencia. No se guardan datos de tarjeta.

Revision ID: 0019
Revises: 0018
Create Date: 2026-11-24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: str | Sequence[str] | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ESQUEMA = "app"


def upgrade() -> None:
    op.add_column("usuario", sa.Column("telefono", sa.String(20)), schema=ESQUEMA)
    op.add_column(
        "usuario",
        sa.Column("terminos_aceptados_en", sa.DateTime(timezone=True)),
        schema=ESQUEMA,
    )
    op.create_table(
        "convenio_codigo",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("codigo", sa.String(32), nullable=False, unique=True),
        sa.Column("plan_id", sa.Integer, sa.ForeignKey(f"{ESQUEMA}.plan.id"), nullable=False),
        sa.Column("precio_bs", sa.Numeric(10, 2), nullable=False),
        sa.Column("cupos", sa.Integer, nullable=False),
        sa.Column("vence", sa.Date, nullable=False),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("precio_bs >= 0", name="precio_convenio_no_negativo"),
        sa.CheckConstraint("cupos > 0", name="cupos_positivos"),
        schema=ESQUEMA,
    )
    op.add_column(
        "suscripcion",
        sa.Column(
            "convenio_codigo_id",
            sa.Integer,
            sa.ForeignKey(f"{ESQUEMA}.convenio_codigo.id"),
        ),
        schema=ESQUEMA,
    )
    op.create_index(
        "ix_suscripcion_convenio_codigo", "suscripcion", ["convenio_codigo_id"], schema=ESQUEMA
    )


def downgrade() -> None:
    op.drop_index("ix_suscripcion_convenio_codigo", table_name="suscripcion", schema=ESQUEMA)
    op.drop_column("suscripcion", "convenio_codigo_id", schema=ESQUEMA)
    op.drop_table("convenio_codigo", schema=ESQUEMA)
    op.drop_column("usuario", "terminos_aceptados_en", schema=ESQUEMA)
    op.drop_column("usuario", "telefono", schema=ESQUEMA)
