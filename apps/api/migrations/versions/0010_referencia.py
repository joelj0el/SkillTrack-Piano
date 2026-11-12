"""Referencia por consenso, inmutable, y clave foránea desde intento (HU-22)

Un disparador rechaza UPDATE y DELETE: una versión publicada no se edita; la siguiente lleva
otro número.

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0010"
down_revision: str | Sequence[str] | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ESQUEMA = "app"

FUNCION_INMUTABLE = f"""
CREATE FUNCTION {ESQUEMA}.impedir_cambios() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% es inmutable: publica una versión nueva', TG_TABLE_NAME;
END $$
"""


def upgrade() -> None:
    op.create_table(
        "referencia",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "version_ejercicio_id",
            sa.Integer,
            sa.ForeignKey(f"{ESQUEMA}.version_ejercicio.id"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("bandas", JSONB, nullable=False),
        sa.Column("n_docentes", sa.Integer, nullable=False),
        sa.Column("rasgos_descartados", JSONB, nullable=False),
        sa.Column("rasgos_sin_evaluar", JSONB, nullable=False),
        sa.Column("metodo", JSONB, nullable=False),
        sa.Column("origen", JSONB, nullable=False),
        sa.Column("publicada_en", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("version_ejercicio_id", "version"),
        schema=ESQUEMA,
    )
    op.execute(FUNCION_INMUTABLE)
    op.execute(
        f"CREATE TRIGGER referencia_inmutable BEFORE UPDATE OR DELETE ON {ESQUEMA}.referencia "
        f"FOR EACH ROW EXECUTE FUNCTION {ESQUEMA}.impedir_cambios()"
    )
    op.create_foreign_key(
        "intento_referencia_id_fkey",
        "intento",
        "referencia",
        ["referencia_id"],
        ["id"],
        source_schema=ESQUEMA,
        referent_schema=ESQUEMA,
    )


def downgrade() -> None:
    op.drop_constraint("intento_referencia_id_fkey", "intento", schema=ESQUEMA)
    op.drop_table("referencia", schema=ESQUEMA)
    op.execute(f"DROP FUNCTION {ESQUEMA}.impedir_cambios()")
