"""pago por QR con el banco: id del QR, moneda, vencimiento, fecha y hora del pago (HU-40)

Datos mínimos: del pago se guardan nuestro id, el id del QR del banco, monto, moneda, fecha, hora
y estado. No se guardan la imagen del QR ni los datos de quien paga (nombre, documento, cuenta,
banco de origen). `consultado_en` limita las consultas al banco a una cada 5 s por pago.

Revision ID: 0020
Revises: 0019
Create Date: 2026-11-24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0020"
down_revision: str | Sequence[str] | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ESQUEMA = "app"


def upgrade() -> None:
    op.add_column(
        "pago_qr",
        sa.Column("moneda", sa.String(3), nullable=False, server_default="BOB"),
        schema=ESQUEMA,
    )
    op.add_column("pago_qr", sa.Column("qr_id", sa.String(80), unique=True), schema=ESQUEMA)
    op.add_column("pago_qr", sa.Column("vence", sa.Date), schema=ESQUEMA)
    op.add_column("pago_qr", sa.Column("fecha_pago", sa.String(20)), schema=ESQUEMA)
    op.add_column("pago_qr", sa.Column("hora_pago", sa.String(20)), schema=ESQUEMA)
    op.add_column("pago_qr", sa.Column("consultado_en", sa.DateTime(timezone=True)), schema=ESQUEMA)


def downgrade() -> None:
    for columna in ("consultado_en", "hora_pago", "fecha_pago", "vence", "qr_id", "moneda"):
        op.drop_column("pago_qr", columna, schema=ESQUEMA)
