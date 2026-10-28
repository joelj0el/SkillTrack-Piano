from fastapi import APIRouter, HTTPException, status

from app.contracts_gen.asignacion import Asignacion
from app.contracts_gen.asignacion_nueva import AsignacionNueva
from app.contracts_gen.clave_restablecida import ClaveRestablecida
from app.contracts_gen.estudiante_resumen import EstudianteResumen
from app.contracts_gen.usuario_creado import UsuarioCreado
from app.contracts_gen.usuario_listado import UsuarioListado
from app.contracts_gen.usuario_nuevo import UsuarioNuevo
from app.core.reloj import hoy_local
from app.modules.audit import service as auditoria
from app.modules.identity import service as identidad
from app.modules.identity.deps import UsuarioEnSesion
from app.modules.identity.models import Usuario
from app.modules.institutions import service
from app.modules.institutions.deps import AdminDeInstitucion, Ahora, Db, EstudianteAccesible
from app.modules.institutions.models import AsignacionDocente

router = APIRouter(tags=["institutions"])


def _asignacion(fila: AsignacionDocente) -> Asignacion:
    return Asignacion(
        id=fila.id,
        docente_id=fila.docente_id,
        estudiante_id=fila.estudiante_id,
        desde=fila.desde,
        hasta=fila.hasta,
    )


def _resumen(usuario: Usuario) -> EstudianteResumen:
    return EstudianteResumen(
        id=usuario.id,
        usuario=usuario.username,
        nombre_visible=usuario.nombre_visible,
        es_menor=usuario.es_menor,
    )


@router.post(
    "/instituciones/{institucion_id}/usuarios",
    response_model=UsuarioCreado,
    status_code=status.HTTP_201_CREATED,
)
def crear_usuario(
    institucion_id: AdminDeInstitucion,
    datos: UsuarioNuevo,
    actor: UsuarioEnSesion,
    db: Db,
    instante: Ahora,
) -> UsuarioCreado:
    try:
        usuario, clave = identidad.crear_usuario(
            db,
            username=datos.usuario,
            nombre_visible=datos.nombre_visible,
            email=datos.email,
            es_menor=datos.es_menor,
        )
    except identidad.UsuarioDuplicado:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ese nombre de usuario ya existe") from None
    service.agregar_membresia(db, usuario.id, institucion_id, datos.rol.value)
    auditoria.registrar(
        db,
        actor_id=actor.id,
        accion="crear_usuario",
        recurso="usuario",
        recurso_id=usuario.id,
        fecha=instante,
    )
    db.commit()
    return UsuarioCreado(id=usuario.id, usuario=usuario.username, clave_temporal=clave)


@router.get("/instituciones/{institucion_id}/usuarios", response_model=list[UsuarioListado])
def listar_usuarios(institucion_id: AdminDeInstitucion, db: Db) -> list[UsuarioListado]:
    roles = service.miembros(db, institucion_id)
    return [
        UsuarioListado(
            id=u.id,
            usuario=u.username,
            nombre_visible=u.nombre_visible,
            es_menor=u.es_menor,
            roles=sorted(roles[u.id]),
        )
        for u in identidad.usuarios_por_id(db, list(roles))
    ]


@router.post(
    "/instituciones/{institucion_id}/asignaciones",
    response_model=Asignacion,
    status_code=status.HTTP_201_CREATED,
)
def crear_asignacion(
    institucion_id: AdminDeInstitucion, datos: AsignacionNueva, db: Db, instante: Ahora
) -> Asignacion:
    if not service.tiene_rol(db, datos.docente_id, institucion_id, "docente"):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "docente_id: no es docente de la institución"
        )
    if not service.tiene_rol(db, datos.estudiante_id, institucion_id, "estudiante"):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "estudiante_id: no es estudiante de la institución",
        )
    fila = service.crear_asignacion(
        db, institucion_id, datos.docente_id, datos.estudiante_id, hoy_local(instante)
    )
    db.commit()
    return _asignacion(fila)


@router.get("/instituciones/{institucion_id}/asignaciones", response_model=list[Asignacion])
def listar_asignaciones(institucion_id: AdminDeInstitucion, db: Db) -> list[Asignacion]:
    return [_asignacion(a) for a in service.asignaciones(db, institucion_id)]


@router.post(
    "/instituciones/{institucion_id}/asignaciones/{asignacion_id}/cerrar",
    response_model=Asignacion,
)
def cerrar_asignacion(
    institucion_id: AdminDeInstitucion, asignacion_id: int, db: Db, instante: Ahora
) -> Asignacion:
    fila = db.get(AsignacionDocente, asignacion_id)
    if fila is None or fila.institucion_id != institucion_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asignación no encontrada")
    # La fecha de fin es el primer día sin acceso: cerrar hoy quita el acceso desde ya.
    fila.hasta = hoy_local(instante)
    db.commit()
    return _asignacion(fila)


@router.get("/mis-estudiantes", response_model=list[EstudianteResumen])
def mis_estudiantes(usuario: UsuarioEnSesion, db: Db, instante: Ahora) -> list[EstudianteResumen]:
    ids = service.estudiantes_de(db, usuario.id, hoy_local(instante))
    return [_resumen(u) for u in identidad.usuarios_por_id(db, ids)]


@router.post("/estudiantes/{estudiante_id}/restablecer-clave", response_model=ClaveRestablecida)
def restablecer_clave(
    estudiante_id: EstudianteAccesible, actor: UsuarioEnSesion, db: Db, instante: Ahora
) -> ClaveRestablecida:
    clave = identidad.restablecer_clave(db, estudiante_id)
    auditoria.registrar(
        db,
        actor_id=actor.id,
        accion="restablecer_clave",
        recurso="estudiante",
        recurso_id=estudiante_id,
        fecha=instante,
    )
    db.commit()
    return ClaveRestablecida(clave_temporal=clave)


@router.get("/estudiantes/{estudiante_id}", response_model=EstudianteResumen)
def ver_estudiante(estudiante_id: EstudianteAccesible, db: Db) -> EstudianteResumen:
    [estudiante] = identidad.usuarios_por_id(db, [estudiante_id])
    return _resumen(estudiante)
