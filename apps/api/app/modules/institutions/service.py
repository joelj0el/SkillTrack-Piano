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
