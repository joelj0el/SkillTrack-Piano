from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.institutions.models import Membresia


def membresias_de(db: Session, usuario_id: int) -> list[Membresia]:
    return list(db.scalars(select(Membresia).where(Membresia.usuario_id == usuario_id)))
