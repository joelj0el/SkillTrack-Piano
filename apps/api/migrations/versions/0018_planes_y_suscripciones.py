"""planes, suscripciones, solicitudes de acceso y pagos por QR (HU-39, ADR-004)

Un precio o un límite vacío es "sin definir". La migración no crea planes: los carga la semilla
de demostración (con precio y límites vacíos) o el superadministrador.

Revision ID: 0018
Revises: 0017
Create Date: 2026-11-24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0018"
down_revision: str | Sequence[str] | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ESQUEMA = "app"


def upgrade() -> None:
    op.create_table(
        "plan",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("nombre", sa.String(80), nullable=False, unique=True),
        sa.Column("descripcion", sa.String(240), nullable=False),
        sa.Column("beneficios", postgresql.ARRAY(sa.String(160)), nullable=False),
        sa.Column("precio_bs", sa.Numeric(10, 2)),
        sa.Column("periodo", sa.String(8), nullable=False),
        sa.Column("limite_docentes", sa.Integer),
        sa.Column("limite_estudiantes", sa.Integer),
        sa.Column("destacado", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("orden", sa.Integer, nullable=False, server_default="0"),
        sa.CheckConstraint("periodo IN ('mensual', 'anual')", name="periodo_valido"),
        sa.CheckConstraint("precio_bs IS NULL OR precio_bs >= 0", name="precio_no_negativo"),
        schema=ESQUEMA,
    )
    op.create_table(
        "suscripcion",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "institucion_id",
            sa.Integer,
            sa.ForeignKey(f"{ESQUEMA}.institucion.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("plan_id", sa.Integer, sa.ForeignKey(f"{ESQUEMA}.plan.id"), nullable=False),
        sa.Column("estado", sa.String(10), nullable=False),
        sa.Column("inicio", sa.Date),
        sa.Column("fin", sa.Date),
        sa.Column("convenio", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("condiciones", sa.Text),
        sa.Column("limite_docentes", sa.Integer),
        sa.Column("limite_estudiantes", sa.Integer),
        sa.Column(
            "creada_en", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "estado IN ('pendiente', 'activa', 'vencida', 'cancelada')", name="estado_valido"
        ),
        sa.CheckConstraint(
            "inicio IS NULL OR fin IS NULL OR inicio <= fin", name="fechas_en_orden"
        ),
        schema=ESQUEMA,
    )
    op.create_index(
        "ix_suscripcion_institucion", "suscripcion", ["institucion_id", "estado"], schema=ESQUEMA
    )
    op.create_table(
        "solicitud_acceso",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("institucion", sa.String(160), nullable=False),
        sa.Column("correo", sa.String(254), nullable=False),
        sa.Column("telefono", sa.String(20)),
        sa.Column("plan_id", sa.Integer, sa.ForeignKey(f"{ESQUEMA}.plan.id", ondelete="SET NULL")),
        sa.Column("mensaje", sa.Text),
        sa.Column("creada_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("atendida", sa.Boolean, nullable=False, server_default=sa.false()),
        schema=ESQUEMA,
    )
    op.create_table(
        "pago_qr",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "suscripcion_id",
            sa.Integer,
            sa.ForeignKey(f"{ESQUEMA}.suscripcion.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("monto_bs", sa.Numeric(10, 2), nullable=False),
        sa.Column("id_transaccion", sa.String(80), nullable=False, unique=True),
        sa.Column("estado", sa.String(10), nullable=False),
        sa.Column("creado_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("confirmado_en", sa.DateTime(timezone=True)),
        sa.CheckConstraint("monto_bs > 0", name="monto_positivo"),
        sa.CheckConstraint(
            "estado IN ('pendiente', 'pagado', 'vencido', 'anulado')", name="estado_pago_valido"
        ),
        schema=ESQUEMA,
    )


def downgrade() -> None:
    op.drop_table("pago_qr", schema=ESQUEMA)
    op.drop_table("solicitud_acceso", schema=ESQUEMA)
    op.drop_index("ix_suscripcion_institucion", table_name="suscripcion", schema=ESQUEMA)
    op.drop_table("suscripcion", schema=ESQUEMA)
    op.drop_table("plan", schema=ESQUEMA)
