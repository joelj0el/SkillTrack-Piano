"""Vista v_avance_tarea: intentos y repeticiones válidas por tarea y día (HU-37)

El día es el de America/La_Paz. La vista no guarda nada: se calcula a partir de intento, así el
avance tiene una sola verdad (la columna cuenta_para_tarea, que decide el servidor).

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-11
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0009"
down_revision: str | Sequence[str] | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE VIEW app.v_avance_tarea AS
        SELECT i.tarea_id,
               (i.iniciado_en AT TIME ZONE 'America/La_Paz')::date AS dia,
               count(*) FILTER (WHERE i.cuenta_para_tarea) AS validas,
               count(*) AS intentos
        FROM app.intento i
        WHERE i.tarea_id IS NOT NULL
        GROUP BY i.tarea_id, (i.iniciado_en AT TIME ZONE 'America/La_Paz')::date
        """
    )


def downgrade() -> None:
    op.execute("DROP VIEW app.v_avance_tarea")
