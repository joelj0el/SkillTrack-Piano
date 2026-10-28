from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Usuario(Base):
    __tablename__ = "usuario"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True)
    nombre_visible: Mapped[str] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(254))
    hash_clave: Mapped[str] = mapped_column(String(255))
    es_menor: Mapped[bool] = mapped_column(Boolean, default=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    superadmin: Mapped[bool] = mapped_column(Boolean, default=False)
    # La clave la asignó un administrador o docente: hay que cambiarla antes de usar la app.
    clave_temporal: Mapped[bool] = mapped_column(Boolean, default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SesionAuth(Base):
    __tablename__ = "sesion_auth"
    __table_args__ = (Index("ix_sesion_auth_usuario", "usuario_id"),)

    # Hash SHA-256 del token opaco: el token en claro solo vive en la cookie.
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuario.id", ondelete="CASCADE"))
    expira_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ultima_actividad: Mapped[datetime] = mapped_column(DateTime(timezone=True))
