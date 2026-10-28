from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class AuditoriaAcceso(Base):
    __tablename__ = "auditoria_acceso"
    __table_args__ = (Index("ix_auditoria_recurso_fecha", "recurso", "recurso_id", "fecha"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("usuario.id", ondelete="SET NULL"))
    accion: Mapped[str] = mapped_column(String(64))
    recurso: Mapped[str] = mapped_column(String(64))
    recurso_id: Mapped[int | None]
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
