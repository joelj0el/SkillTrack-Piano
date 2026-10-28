from datetime import datetime

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.contracts_gen.intento_guardado import IntentoGuardado
from app.contracts_gen.resultado_intento import ResultadoIntento
from app.core.reloj import hoy_local
from app.modules.attempts.models import Intento
from app.modules.audit import service as auditoria
from app.modules.catalog import service as catalogo
from app.modules.identity.deps import UsuarioEnSesion
from app.modules.identity.models import Usuario
from app.modules.institutions import service as instituciones
from app.modules.institutions.deps import PROHIBIDO, Ahora, Db
from app.modules.pedagogy import service as pedagogia

router = APIRouter(tags=["attempts"])


def cuenta_para_tarea(datos: ResultadoIntento) -> tuple[bool, str | None]:
    """Lo decide el servidor, no el cliente. En modo solo visión no hay tempo medido: no cuenta."""
    if datos.tarea_id is None:
        return False, "Intento libre, sin tarea"
    if datos.estado.value != "evaluado":
        return False, "Intento no evaluable"
    if datos.modo.value == "V":
        return False, "Solo visión: sin tempo medido"
    return True, None


def _dto(i: Intento) -> IntentoGuardado:
    return IntentoGuardado(
        id=i.id,
        client_uuid=i.client_uuid,
        estudiante_id=i.estudiante_id,
        tarea_id=i.tarea_id,
        estado=i.estado,
        motivo_no_evaluable=i.motivo_no_evaluable,
        cuenta_para_tarea=i.cuenta_para_tarea,
        motivo_no_cuenta=i.motivo_no_cuenta,
        version_nucleo=i.version_nucleo,
        version_modelo_mano=i.version_modelo_mano,
        instrumento=i.instrumento,
        manos=i.manos,
        modo_metronomo=i.modo_metronomo,
        tempo_elegido_bpm=i.tempo_elegido_bpm,
        iniciado_en=i.iniciado_en,
    )


@router.post("/intentos", response_model=IntentoGuardado, status_code=status.HTTP_201_CREATED)
def guardar_intento(
    datos: ResultadoIntento, respuesta: Response, usuario: UsuarioEnSesion, db: Db
) -> IntentoGuardado:
    if not instituciones.instituciones_de(db, usuario.id, "estudiante"):
        raise PROHIBIDO
    existente = db.scalar(select(Intento).where(Intento.client_uuid == str(datos.client_uuid)))
    if existente is not None:
        if existente.estudiante_id != usuario.id:
            raise HTTPException(status.HTTP_409_CONFLICT, "client_uuid ya usado")
        respuesta.status_code = status.HTTP_200_OK
        return _dto(existente)
    if not catalogo.version_existe(db, datos.version_ejercicio_id):
        raise pedagogia.error_de_campo("version_ejercicio_id", "La versión no existe.")
    if datos.tarea_id is not None and not pedagogia.tarea_es_de(db, datos.tarea_id, usuario.id):
        raise pedagogia.error_de_campo("tarea_id", "La tarea no es tuya.")
    cuenta, motivo = cuenta_para_tarea(datos)
    intento = Intento(
        client_uuid=str(datos.client_uuid),
        estudiante_id=usuario.id,
        version_ejercicio_id=datos.version_ejercicio_id,
        tarea_id=datos.tarea_id,
        version_nucleo=datos.version_nucleo,
        version_modelo_mano=datos.version_modelo_mano,
        instrumento=datos.instrumento.value,
        manos=datos.manos.value,
        clase_dispositivo=datos.clase_dispositivo,
        modo=datos.modo.value,
        modo_metronomo=datos.modo_metronomo.value if datos.modo_metronomo else None,
        tempo_elegido_bpm=datos.tempo_elegido_bpm,
        estado=datos.estado.value,
        motivo_no_evaluable=datos.motivo_no_evaluable,
        cuenta_para_tarea=cuenta,
        motivo_no_cuenta=motivo,
        iniciado_en=datos.iniciado_en,
        duracion_ms=datos.duracion_ms,
        pct_eventos_evaluables=datos.pct_eventos_evaluables,
        pct_digitacion_correcta=datos.pct_digitacion_correcta,
        eventos=[e.model_dump() for e in datos.eventos],
    )
    db.add(intento)
    db.commit()
    return _dto(intento)


def _ver(db: Session, intento: Intento | None, usuario: Usuario, instante: datetime) -> Intento:
    """Propio o de un estudiante asignado; un docente ajeno recibe 403 (auditado)."""

    if intento is not None:
        if intento.estudiante_id == usuario.id:
            return intento
        if instituciones.asignacion_vigente(
            db, usuario.id, intento.estudiante_id, hoy_local(instante)
        ):
            return intento
        if instituciones.instituciones_de(db, usuario.id, "docente"):
            auditoria.registrar(
                db,
                actor_id=usuario.id,
                accion="acceso_denegado",
                recurso="intento",
                recurso_id=intento.id,
                fecha=instante,
            )
            db.commit()
            raise PROHIBIDO
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Intento no encontrado")


@router.get("/intentos/{intento_id}", response_model=IntentoGuardado)
def ver_intento(
    intento_id: int, usuario: UsuarioEnSesion, db: Db, instante: Ahora
) -> IntentoGuardado:
    return _dto(_ver(db, db.get(Intento, intento_id), usuario, instante))


@router.get("/mis-intentos", response_model=list[IntentoGuardado])
def mis_intentos(usuario: UsuarioEnSesion, db: Db) -> list[IntentoGuardado]:
    consulta = (
        select(Intento)
        .where(Intento.estudiante_id == usuario.id)
        .order_by(Intento.iniciado_en.desc())
    )
    return [_dto(i) for i in db.scalars(consulta)]
