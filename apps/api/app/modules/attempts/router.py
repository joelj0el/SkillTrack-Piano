from datetime import datetime

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.contracts_gen.intento_guardado import IntentoGuardado
from app.contracts_gen.resultado_intento import ResultadoIntento
from app.contracts_gen.resultado_intento_v1 import ResultadoIntentoV1
from app.core.reloj import hoy_local
from app.modules.attempts.conversion import evento_v1_a_v2
from app.modules.attempts.models import Intento
from app.modules.audit import service as auditoria
from app.modules.catalog import service as catalogo
from app.modules.identity.deps import UsuarioEnSesion
from app.modules.identity.models import Usuario
from app.modules.institutions import service as instituciones
from app.modules.institutions.deps import PROHIBIDO, Ahora, Db
from app.modules.pedagogy import service as pedagogia
from app.modules.pedagogy.models import Tarea

router = APIRouter(tags=["attempts"])


def cuenta_para_tarea(datos: ResultadoIntento, tarea: Tarea | None) -> tuple[bool, str | None]:
    """Lo decide el servidor con las condiciones vigentes de la tarea; no se confía en el cliente.

    Cuenta si está evaluado y su tempo medido cae dentro del rango de la tarea. Sin tempo medido
    (por ejemplo, en modo solo visión) no cuenta, y la práctica lenta (DP-18) tampoco.
    """
    if tarea is None:
        return False, "Intento libre, sin tarea"
    if tarea.cancelada_en is not None:
        return False, "Tarea cancelada"
    if datos.estado.value != "evaluado":
        return False, "Intento no evaluable"
    if datos.tempo_medido_bpm is None:
        return False, "Sin tempo medido"
    if datos.tempo_elegido_bpm is not None and datos.tempo_elegido_bpm < tarea.tempo_min_bpm:
        return False, "Práctica lenta"
    medido = round(datos.tempo_medido_bpm)
    if not tarea.tempo_min_bpm <= medido <= tarea.tempo_max_bpm:
        return (
            False,
            f"Tocaste a ♩≈{medido}; tu tarea pide {tarea.tempo_min_bpm}–{tarea.tempo_max_bpm}",
        )
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
        tempo_medido_bpm=i.tempo_medido_bpm,
        secuencia_esperada=i.secuencia_esperada,
        referencia_id=i.referencia_id,
        conjunto_reglas_id=i.conjunto_reglas_id,
        version_ejercicio_id=i.version_ejercicio_id,
        calificacion=i.calificacion,
        iniciado_en=i.iniciado_en,
    )


def a_v2(recibido: ResultadoIntento | ResultadoIntentoV1) -> ResultadoIntento:
    """La app en caché o un intento que quedó en cola pueden llegar todavía en la v1."""
    if isinstance(recibido, ResultadoIntento):
        return recibido
    datos = recibido.model_dump(mode="json")
    datos["eventos"] = [evento_v1_a_v2(e) for e in datos["eventos"]]
    # La v1 no medía el tempo: esos intentos no cuentan para la tarea.
    sin_medir = dict.fromkeys(
        ("tempo_medido_bpm", "referencia_temporal", "cambio_tempo_pct", "audio_sin_procesar")
    )
    return ResultadoIntento.model_validate({"version": 2, **datos, **sin_medir})


@router.post("/intentos", response_model=IntentoGuardado, status_code=status.HTTP_201_CREATED)
def guardar_intento(
    recibido: ResultadoIntento | ResultadoIntentoV1,
    respuesta: Response,
    usuario: UsuarioEnSesion,
    db: Db,
) -> IntentoGuardado:
    datos = a_v2(recibido)
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
    if datos.referencia_id is not None and not catalogo.referencia_es_de(
        db, datos.referencia_id, datos.version_ejercicio_id
    ):
        raise pedagogia.error_de_campo(
            "referencia_id", "La referencia no existe o es de otro ejercicio."
        )
    if datos.conjunto_reglas_id is not None and not catalogo.reglas_por_id(
        db, datos.conjunto_reglas_id
    ):
        raise pedagogia.error_de_campo("conjunto_reglas_id", "El conjunto de reglas no existe.")
    tarea = db.get(Tarea, datos.tarea_id) if datos.tarea_id is not None else None
    cuenta, motivo = cuenta_para_tarea(datos, tarea)
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
        tempo_medido_bpm=datos.tempo_medido_bpm,
        referencia_temporal=(
            datos.referencia_temporal.value if datos.referencia_temporal else None
        ),
        cambio_tempo_pct=datos.cambio_tempo_pct,
        audio_sin_procesar=datos.audio_sin_procesar,
        estado=datos.estado.value,
        motivo_no_evaluable=datos.motivo_no_evaluable,
        cuenta_para_tarea=cuenta,
        motivo_no_cuenta=motivo,
        iniciado_en=datos.iniciado_en,
        duracion_ms=datos.duracion_ms,
        pct_eventos_evaluables=datos.pct_eventos_evaluables,
        pct_digitacion_correcta=datos.pct_digitacion_correcta,
        secuencia_esperada=(
            datos.secuencia_esperada.value if datos.secuencia_esperada else "provisional"
        ),
        referencia_id=datos.referencia_id,
        conjunto_reglas_id=datos.conjunto_reglas_id,
        calificacion=(
            [c.model_dump(mode="json") for c in datos.calificacion] if datos.calificacion else None
        ),
        eventos=[e.model_dump(mode="json") for e in datos.eventos],
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
