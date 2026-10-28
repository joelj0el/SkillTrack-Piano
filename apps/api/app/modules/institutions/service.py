from datetime import date

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.modules.institutions.models import AsignacionDocente, Membresia


def membresias_de(db: Session, usuario_id: int) -> list[Membresia]:
    return list(db.scalars(select(Membresia).where(Membresia.usuario_id == usuario_id)))


def _vigente(hoy: date):
    return or_(AsignacionDocente.hasta.is_(None), AsignacionDocente.hasta > hoy)


def asignacion_vigente(db: Session, docente_id: int, estudiante_id: int, hoy: date) -> bool:
    consulta = select(AsignacionDocente.id).where(
        AsignacionDocente.docente_id == docente_id,
        AsignacionDocente.estudiante_id == estudiante_id,
        AsignacionDocente.desde <= hoy,
        _vigente(hoy),
    )
    return db.scalar(consulta.limit(1)) is not None


def estudiantes_de(db: Session, docente_id: int, hoy: date) -> list[int]:
    """IDs de los estudiantes con asignación vigente; los datos del usuario los da identity."""
    consulta = (
        select(AsignacionDocente.estudiante_id)
        .where(
            AsignacionDocente.docente_id == docente_id,
            AsignacionDocente.desde <= hoy,
            _vigente(hoy),
        )
        .distinct()
    )
    return list(db.scalars(consulta))


def agregar_membresia(db: Session, usuario_id: int, institucion_id: int, rol: str) -> None:
    db.add(Membresia(usuario_id=usuario_id, institucion_id=institucion_id, rol=rol))


def miembros(db: Session, institucion_id: int) -> dict[int, list[str]]:
    """Roles de cada usuario de la institución."""
    filas = db.execute(
        select(Membresia.usuario_id, Membresia.rol).where(
            Membresia.institucion_id == institucion_id
        )
    )
    roles: dict[int, list[str]] = {}
    for usuario_id, rol in filas:
        roles.setdefault(usuario_id, []).append(rol)
    return roles


def tiene_rol(db: Session, usuario_id: int, institucion_id: int, rol: str) -> bool:
    return rol in miembros(db, institucion_id).get(usuario_id, [])


def crear_asignacion(
    db: Session, institucion_id: int, docente_id: int, estudiante_id: int, hoy: date
) -> AsignacionDocente:
    asignacion = AsignacionDocente(
        institucion_id=institucion_id, docente_id=docente_id, estudiante_id=estudiante_id, desde=hoy
    )
    db.add(asignacion)
    db.flush()
    return asignacion


def asignaciones(db: Session, institucion_id: int) -> list[AsignacionDocente]:
    consulta = (
        select(AsignacionDocente)
        .where(AsignacionDocente.institucion_id == institucion_id)
        .order_by(AsignacionDocente.id)
    )
    return list(db.scalars(consulta))


def es_admin_de(db: Session, usuario_id: int, institucion_id: int) -> bool:
    consulta = select(Membresia.usuario_id).where(
        Membresia.usuario_id == usuario_id,
        Membresia.institucion_id == institucion_id,
        Membresia.rol == "admin_inst",
    )
    return db.scalar(consulta.limit(1)) is not None


def instituciones_de(db: Session, usuario_id: int, rol: str | None = None) -> list[int]:
    consulta = select(Membresia.institucion_id).where(Membresia.usuario_id == usuario_id)
    if rol is not None:
        consulta = consulta.where(Membresia.rol == rol)
    return list(db.scalars(consulta.distinct()))
