from datetime import date, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.contracts_gen.tarea import Aspecto, EjercicioDeTarea
from app.contracts_gen.tarea import Observacion as ObservacionDto
from app.contracts_gen.tarea import Tarea as TareaDto
from app.modules.catalog import service as catalogo
from app.modules.pedagogy.models import Observacion, Tarea


def estado(tarea: Tarea, hoy: date) -> str:
    """Estado calculado: Cancelada > Vencida > Asignada (sin intentos todavía: It-1)."""
    if tarea.cancelada_en is not None:
        return "Cancelada"
    if tarea.fecha_limite < hoy:
        return "Vencida"
    return "Asignada"


def error_de_campo(campo: str, mensaje: str) -> HTTPException:
    """422 con la misma forma que los errores de validación de FastAPI (indica el campo)."""
    return HTTPException(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        [{"loc": ["body", campo], "msg": mensaje, "type": "value_error"}],
    )


def validar_condiciones(
    tempo_min: int, tempo_max: int, fecha_limite: date, hoy: date, *, fecha_cambia: bool = True
) -> None:
    if tempo_min > tempo_max:
        raise error_de_campo("tempo_min_bpm", "El tempo mínimo no puede superar al máximo.")
    if fecha_cambia and fecha_limite < hoy:
        raise error_de_campo("fecha_limite", "El plazo no puede ser anterior a hoy.")


def observaciones_de(db: Session, tarea_ids: list[int]) -> dict[int, list[Observacion]]:
    if not tarea_ids:
        return {}
    consulta = (
        select(Observacion)
        .where(Observacion.tarea_id.in_(tarea_ids))
        .order_by(Observacion.creada_en.desc(), Observacion.id.desc())
    )
    agrupadas: dict[int, list[Observacion]] = {}
    for obs in db.scalars(consulta):
        agrupadas.setdefault(obs.tarea_id, []).append(obs)
    return agrupadas


def observacion_dto(db: Session, obs: Observacion) -> ObservacionDto:
    clase = catalogo.clase_error_por_id(db, obs.clase_error_id) if obs.clase_error_id else None
    return ObservacionDto(
        id=obs.id,
        tarea_id=obs.tarea_id,
        aspecto=Aspecto(codigo=clase.codigo, nombre=clase.nombre_pedagogico) if clase else None,
        texto=obs.texto,
        creada_en=obs.creada_en,
    )


def tareas_dto(db: Session, tareas: list[Tarea], hoy: date) -> list[TareaDto]:
    ejercicios = catalogo.ejercicios_por_id(db, list({t.ejercicio_id for t in tareas}))
    observaciones = observaciones_de(db, [t.id for t in tareas])
    return [
        TareaDto(
            id=t.id,
            estudiante_id=t.estudiante_id,
            docente_id=t.docente_id,
            ejercicio=EjercicioDeTarea(
                id=t.ejercicio_id,
                codigo=ejercicios[t.ejercicio_id].codigo,
                nombre=ejercicios[t.ejercicio_id].nombre,
            ),
            manos=t.manos,
            tempo_min_bpm=t.tempo_min_bpm,
            tempo_max_bpm=t.tempo_max_bpm,
            repeticiones_por_dia=t.repeticiones_por_dia,
            fecha_limite=t.fecha_limite,
            estado=estado(t, hoy),
            observaciones=[observacion_dto(db, o) for o in observaciones.get(t.id, [])],
        )
        for t in tareas
    ]


def tareas_de_estudiante(db: Session, estudiante_id: int) -> list[Tarea]:
    """Ordenadas por plazo: la más próxima primero (PA-HU29-01)."""
    consulta = (
        select(Tarea)
        .where(Tarea.estudiante_id == estudiante_id)
        .order_by(Tarea.fecha_limite, Tarea.id)
    )
    return list(db.scalars(consulta))


def marcar_actualizada(tarea: Tarea, instante: datetime) -> None:
    tarea.actualizada_en = instante
