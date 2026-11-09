from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.audit.models import AuditoriaAcceso


def registrar(
    db: Session,
    *,
    actor_id: int | None,
    accion: str,
    recurso: str,
    recurso_id: int | None,
    fecha: datetime,
) -> None:
    db.add(
        AuditoriaAcceso(
            actor_id=actor_id, accion=accion, recurso=recurso, recurso_id=recurso_id, fecha=fecha
        )
    )


def contar(db: Session, *, accion: str, recurso: str, recurso_id: int, desde: datetime) -> int:
    consulta = select(func.count()).where(
        AuditoriaAcceso.accion == accion,
        AuditoriaAcceso.recurso == recurso,
        AuditoriaAcceso.recurso_id == recurso_id,
        AuditoriaAcceso.fecha > desde,
    )
    return db.scalar(consulta) or 0
