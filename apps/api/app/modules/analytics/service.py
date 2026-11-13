"""Tableros descriptivos (HU-15): se leen de las vistas; nada se ordena ni compara por desempeño."""

from datetime import date

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.contracts_gen.mi_grupo import ErrorRecurrente, EstudianteDelGrupo, MiGrupo
from app.contracts_gen.mi_progreso import MiProgreso, SemanaDeProgreso
from app.modules.identity.models import Usuario


def progreso(db: Session, estudiante_id: int) -> MiProgreso:
    filas = db.execute(
        text(
            "SELECT semana, clase, intentos, pct_promedio FROM app.v_progreso_estudiante "
            "WHERE estudiante_id = :id ORDER BY semana, clase"
        ),
        {"id": estudiante_id},
    ).mappings()
    return MiProgreso(semanas=[SemanaDeProgreso.model_validate(dict(f)) for f in filas])


def grupo(db: Session, docente_id: int, hoy: date, ultimos: int) -> MiGrupo:
    db.execute(text("SELECT set_config('app.hoy', :hoy, true)"), {"hoy": hoy.isoformat()})
    ids = list(
        db.scalars(
            text("SELECT estudiante_id FROM app.v_grupo_docente WHERE docente_id = :d"),
            {"d": docente_id},
        )
    )
    if not ids:
        return MiGrupo(ultimos=ultimos, estudiantes=[])
    considerados = dict(
        db.execute(
            text(
                "SELECT estudiante_id, count(DISTINCT intento_id) FROM app.v_errores_recurrentes "
                "WHERE estudiante_id = ANY(:ids) AND orden <= :n GROUP BY estudiante_id"
            ),
            {"ids": ids, "n": ultimos},
        ).all()
    )
    errores: dict[int, list[ErrorRecurrente]] = {}
    filas = db.execute(
        text(
            "SELECT estudiante_id, clase, count(DISTINCT intento_id) AS intentos_con_error, "
            "array_agg(DISTINCT indicador ORDER BY indicador) AS indicadores "
            "FROM app.v_errores_recurrentes "
            "WHERE estudiante_id = ANY(:ids) AND orden <= :n AND clase IS NOT NULL "
            "GROUP BY estudiante_id, clase ORDER BY clase"
        ),
        {"ids": ids, "n": ultimos},
    ).mappings()
    for f in filas:
        errores.setdefault(f["estudiante_id"], []).append(
            ErrorRecurrente(
                clase=f["clase"],
                intentos_con_error=f["intentos_con_error"],
                indicadores=f["indicadores"],
            )
        )
    # Orden alfabético por nombre: nunca por la cantidad de errores (sin rankings).
    usuarios = db.scalars(
        select(Usuario).where(Usuario.id.in_(ids)).order_by(Usuario.nombre_visible, Usuario.id)
    )
    return MiGrupo(
        ultimos=ultimos,
        estudiantes=[
            EstudianteDelGrupo(
                estudiante_id=u.id,
                nombre_visible=u.nombre_visible,
                intentos_considerados=considerados.get(u.id, 0),
                errores=errores.get(u.id, []),
            )
            for u in usuarios
        ],
    )
