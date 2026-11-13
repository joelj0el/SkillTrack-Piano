"""Vistas de los tableros (HU-15): progreso del estudiante, errores recurrentes y grupo del docente

Solo describen: % promedio por variable y semana del propio estudiante, y en qué intentos
recientes apareció cada clase de error. Ninguna vista ordena ni compara estudiantes.

Revision ID: 0017
Revises: 0016
Create Date: 2026-11-13
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0017"
down_revision: str | Sequence[str] | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Semana de lunes a domingo en America/La_Paz; solo variables con % (las "no evaluado" no).
    op.execute(
        """
        CREATE VIEW app.v_progreso_estudiante AS
        SELECT i.estudiante_id,
               date_trunc('week', i.iniciado_en AT TIME ZONE 'America/La_Paz')::date AS semana,
               c->>'clase' AS clase,
               count(*) AS intentos,
               round(avg((c->>'pct')::numeric), 1) AS pct_promedio
        FROM app.intento i
        CROSS JOIN LATERAL jsonb_array_elements(i.calificacion) c
        WHERE i.estado = 'evaluado' AND i.calificacion IS NOT NULL AND c->>'pct' IS NOT NULL
        GROUP BY i.estudiante_id, semana, c->>'clase'
        """
    )
    # Intentos evaluados con reglas, numerados del más reciente (orden 1) al más antiguo; una
    # fila por indicador detectado, o una sola con indicador nulo si no se detectó ninguno.
    # La clase sale del código del indicador (IND-A1 → ER-A), como en la taxonomía.
    op.execute(
        """
        CREATE VIEW app.v_errores_recurrentes AS
        WITH ordenados AS (
          SELECT i.id AS intento_id, i.estudiante_id, i.indicadores_deficientes,
                 row_number() OVER (PARTITION BY i.estudiante_id
                                    ORDER BY i.iniciado_en DESC, i.id DESC) AS orden
          FROM app.intento i
          WHERE i.estado = 'evaluado' AND i.indicadores_deficientes IS NOT NULL
        )
        SELECT o.estudiante_id, o.intento_id, o.orden,
               'ER-' || substr(d.indicador, 5, 1) AS clase, d.indicador
        FROM ordenados o
        LEFT JOIN LATERAL unnest(o.indicadores_deficientes) AS d(indicador) ON true
        """
    )
    # Estudiantes con asignación vigente; "hoy" como en v_estado_tarea.
    op.execute(
        """
        CREATE VIEW app.v_grupo_docente AS
        SELECT DISTINCT a.docente_id, a.estudiante_id
        FROM app.asignacion_docente a
        CROSS JOIN LATERAL (
          SELECT coalesce(nullif(current_setting('app.hoy', true), '')::date,
                          (now() AT TIME ZONE 'America/La_Paz')::date) AS hoy
        ) h
        WHERE a.desde <= h.hoy AND (a.hasta IS NULL OR a.hasta > h.hoy)
        """
    )


def downgrade() -> None:
    op.execute("DROP VIEW app.v_grupo_docente")
    op.execute("DROP VIEW app.v_errores_recurrentes")
    op.execute("DROP VIEW app.v_progreso_estudiante")
