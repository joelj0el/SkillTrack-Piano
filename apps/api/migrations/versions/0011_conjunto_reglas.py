"""Conjunto de reglas versionado, inmutable, y clave foránea desde intento (HU-23)

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0011"
down_revision: str | Sequence[str] | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ESQUEMA = "app"


def upgrade() -> None:
    op.create_table(
        "conjunto_reglas",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("version", sa.Integer, nullable=False, unique=True),
        sa.Column("version_taxonomia", sa.String(16), nullable=False),
        sa.Column("reglas", JSONB, nullable=False),
        sa.Column("publicada_en", sa.DateTime(timezone=True), nullable=False),
        schema=ESQUEMA,
    )
    # La función impedir_cambios() la crea la migración 0010.
    op.execute(
        f"CREATE TRIGGER conjunto_reglas_inmutable BEFORE UPDATE OR DELETE "
        f"ON {ESQUEMA}.conjunto_reglas FOR EACH ROW EXECUTE FUNCTION {ESQUEMA}.impedir_cambios()"
    )
    op.create_foreign_key(
        "intento_conjunto_reglas_id_fkey",
        "intento",
        "conjunto_reglas",
        ["conjunto_reglas_id"],
        ["id"],
        source_schema=ESQUEMA,
        referent_schema=ESQUEMA,
    )


def downgrade() -> None:
    op.drop_constraint("intento_conjunto_reglas_id_fkey", "intento", schema=ESQUEMA)
    op.drop_table("conjunto_reglas", schema=ESQUEMA)
