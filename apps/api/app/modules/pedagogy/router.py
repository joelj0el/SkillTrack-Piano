from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import Session

from app.contracts_gen.observacion import Observacion as ObservacionDto
from app.contracts_gen.observacion_nueva import ObservacionNueva
from app.contracts_gen.tarea import Tarea as TareaDto
from app.contracts_gen.tarea_cambio import TareaCambio
from app.contracts_gen.tarea_nueva import TareaNueva
from app.core.reloj import hoy_local
from app.modules.audit import service as auditoria
from app.modules.catalog import service as catalogo
from app.modules.identity.deps import UsuarioEnSesion
from app.modules.identity.models import Usuario
from app.modules.institutions import service as instituciones
from app.modules.institutions.deps import PROHIBIDO, Ahora, Db, EstudianteAccesible
from app.modules.pedagogy import service
from app.modules.pedagogy.models import Observacion, Tarea

router = APIRouter(tags=["pedagogy"])


def _denegar(db: Session, actor: Usuario, recurso: str, recurso_id: int | None, instante: datetime):
    """Registra el intento rechazado (PA-HU14-03) y responde 403."""
    auditoria.registrar(
        db,
        actor_id=actor.id,
        accion="acceso_denegado",
        recurso=recurso,
        recurso_id=recurso_id,
        fecha=instante,
    )
    db.commit()
    return PROHIBIDO


def _tarea_del_docente(db: Session, tarea_id: int, docente: Usuario, instante: datetime) -> Tarea:
    tarea = db.get(Tarea, tarea_id)
    if tarea is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tarea no encontrada")
    if not instituciones.asignacion_vigente(
        db, docente.id, tarea.estudiante_id, hoy_local(instante)
    ):
        raise _denegar(db, docente, "tarea", tarea_id, instante)
    return tarea


@router.post("/tareas", response_model=TareaDto, status_code=status.HTTP_201_CREATED)
def crear_tarea(datos: TareaNueva, docente: UsuarioEnSesion, db: Db, instante: Ahora) -> TareaDto:
    hoy = hoy_local(instante)
    institucion_id = instituciones.institucion_de_asignacion(
        db, docente.id, datos.estudiante_id, hoy
    )
    if institucion_id is None:
        raise _denegar(db, docente, "estudiante", datos.estudiante_id, instante)
    ejercicio = catalogo.ejercicio_por_id(db, datos.ejercicio_id)
    if ejercicio is None:
        raise service.error_de_campo("ejercicio_id", "El ejercicio no existe.")
    if datos.manos.value not in ejercicio.variantes_manos:
        raise service.error_de_campo("manos", "El ejercicio no tiene esa variante de manos.")
    service.validar_condiciones(datos.tempo_min_bpm, datos.tempo_max_bpm, datos.fecha_limite, hoy)
    tarea = Tarea(
        institucion_id=institucion_id,
        docente_id=docente.id,
        estudiante_id=datos.estudiante_id,
        ejercicio_id=datos.ejercicio_id,
        manos=datos.manos.value,
        tempo_min_bpm=datos.tempo_min_bpm,
        tempo_max_bpm=datos.tempo_max_bpm,
        repeticiones_por_dia=datos.repeticiones_por_dia,
        fecha_limite=datos.fecha_limite,
        creada_en=instante,
        actualizada_en=instante,
    )
    db.add(tarea)
    db.commit()
    return service.tareas_dto(db, [tarea], hoy)[0]


@router.patch("/tareas/{tarea_id}", response_model=TareaDto)
def cambiar_tarea(
    tarea_id: int, datos: TareaCambio, docente: UsuarioEnSesion, db: Db, instante: Ahora
) -> TareaDto:
    hoy = hoy_local(instante)
    tarea = _tarea_del_docente(db, tarea_id, docente, instante)
    if tarea.cancelada_en is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "La tarea está cancelada")
    nuevos = datos.model_dump(exclude_unset=True)
    service.validar_condiciones(
        nuevos.get("tempo_min_bpm", tarea.tempo_min_bpm),
        nuevos.get("tempo_max_bpm", tarea.tempo_max_bpm),
        nuevos.get("fecha_limite", tarea.fecha_limite),
        hoy,
        fecha_cambia="fecha_limite" in nuevos,
    )
    for campo, valor in nuevos.items():
        setattr(tarea, campo, valor)
    service.marcar_actualizada(tarea, instante)
    db.commit()
    return service.tareas_dto(db, [tarea], hoy)[0]


@router.post("/tareas/{tarea_id}/cancelar", response_model=TareaDto)
def cancelar_tarea(tarea_id: int, docente: UsuarioEnSesion, db: Db, instante: Ahora) -> TareaDto:
    tarea = _tarea_del_docente(db, tarea_id, docente, instante)
    if tarea.cancelada_en is None:
        tarea.cancelada_en = instante
        service.marcar_actualizada(tarea, instante)
        db.commit()
    return service.tareas_dto(db, [tarea], hoy_local(instante))[0]


@router.get("/estudiantes/{estudiante_id}/tareas", response_model=list[TareaDto])
def tareas_de_estudiante(
    estudiante_id: EstudianteAccesible, db: Db, instante: Ahora
) -> list[TareaDto]:
    tareas = service.tareas_de_estudiante(db, estudiante_id)
    return service.tareas_dto(db, tareas, hoy_local(instante))


@router.post("/observaciones", response_model=ObservacionDto, status_code=status.HTTP_201_CREATED)
def crear_observacion(
    datos: ObservacionNueva, docente: UsuarioEnSesion, db: Db, instante: Ahora
) -> ObservacionDto:
    tarea = _tarea_del_docente(db, datos.tarea_id, docente, instante)
    texto = datos.texto.strip()
    if not texto:
        raise service.error_de_campo("texto", "La observación no puede estar vacía.")
    if datos.clase_error_id is not None and not catalogo.clase_error_por_id(
        db, datos.clase_error_id
    ):
        raise service.error_de_campo("clase_error_id", "El aspecto no existe.")
    observacion = Observacion(
        docente_id=docente.id,
        estudiante_id=tarea.estudiante_id,
        tarea_id=tarea.id,
        clase_error_id=datos.clase_error_id,
        texto=texto,
        creada_en=instante,
    )
    db.add(observacion)
    db.commit()
    return ObservacionDto.model_validate(service.observacion_dto(db, observacion).model_dump())


def _ver_tarea(db: Session, tarea: Tarea | None, usuario: Usuario, instante: datetime) -> Tarea:
    """El estudiante ve lo suyo; el docente, lo de sus asignados. A otro estudiante: 404."""
    if tarea is not None:
        if tarea.estudiante_id == usuario.id:
            return tarea
        if instituciones.asignacion_vigente(
            db, usuario.id, tarea.estudiante_id, hoy_local(instante)
        ):
            return tarea
        if instituciones.instituciones_de(db, usuario.id, "docente"):
            raise _denegar(db, usuario, "tarea", tarea.id, instante)
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Tarea no encontrada")


@router.get("/mis-tareas", response_model=list[TareaDto])
def mis_tareas(usuario: UsuarioEnSesion, db: Db, instante: Ahora) -> list[TareaDto]:
    tareas = service.tareas_de_estudiante(db, usuario.id)
    return service.tareas_dto(db, tareas, hoy_local(instante))


@router.get("/tareas/{tarea_id}", response_model=TareaDto)
def ver_tarea(tarea_id: int, usuario: UsuarioEnSesion, db: Db, instante: Ahora) -> TareaDto:
    tarea = _ver_tarea(db, db.get(Tarea, tarea_id), usuario, instante)
    return service.tareas_dto(db, [tarea], hoy_local(instante))[0]


@router.get("/observaciones/{observacion_id}", response_model=ObservacionDto)
def ver_observacion(
    observacion_id: int, usuario: UsuarioEnSesion, db: Db, instante: Ahora
) -> ObservacionDto:
    observacion = db.get(Observacion, observacion_id)
    tarea = db.get(Tarea, observacion.tarea_id) if observacion and observacion.tarea_id else None
    _ver_tarea(db, tarea, usuario, instante)
    return ObservacionDto.model_validate(service.observacion_dto(db, observacion).model_dump())
