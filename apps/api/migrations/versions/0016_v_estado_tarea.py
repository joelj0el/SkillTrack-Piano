"""Vista v_estado_tarea: el estado de cada tarea se calcula, no se guarda (HU-37, HU-38)

Cancelada > Revisada (última valoración "lograda") > Vencida (plazo antes de hoy) > En práctica
(≥ 1 intento que cuenta o última valoración "por_repetir") > Asignada. "Hoy" es el día de
America/La_Paz, salvo que la transacción fije `app.hoy` (lo hace la API con su reloj).

Revision ID: 0016
Revises: 0015
Create Date: 2026-11-12
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0016"
down_revision: str | Sequence[str] | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE VIEW app.v_estado_tarea AS
        SELECT t.id AS tarea_id,
               CASE
                 WHEN t.cancelada_en IS NOT NULL THEN 'Cancelada'
                 WHEN v.valor = 'lograda' THEN 'Revisada'
                 WHEN t.fecha_limite < coalesce(
                        nullif(current_setting('app.hoy', true), '')::date,
                        (now() AT TIME ZONE 'America/La_Paz')::date
                      ) THEN 'Vencida'
                 WHEN v.valor = 'por_repetir'
                      OR EXISTS (SELECT 1 FROM app.v_avance_tarea a
                                 WHERE a.tarea_id = t.id AND a.validas > 0)
                   THEN 'En práctica'
                 ELSE 'Asignada'
               END AS estado
        FROM app.tarea t
        LEFT JOIN LATERAL (
          SELECT vt.valor FROM app.valoracion_tarea vt
          WHERE vt.tarea_id = t.id
          ORDER BY vt.creada_en DESC, vt.id DESC
          LIMIT 1
        ) v ON true
        """
    )


def downgrade() -> None:
    op.execute("DROP VIEW app.v_estado_tarea")
