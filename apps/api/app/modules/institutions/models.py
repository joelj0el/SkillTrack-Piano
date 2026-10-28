from sqlalchemy import Boolean, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

ROLES = ("admin_inst", "docente", "estudiante", "investigador")


class Institucion(Base):
    __tablename__ = "institucion"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(160))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


class Membresia(Base):
    __tablename__ = "membresia"

    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuario.id", ondelete="CASCADE"), primary_key=True
    )
    institucion_id: Mapped[int] = mapped_column(ForeignKey("institucion.id"), primary_key=True)
    rol: Mapped[str] = mapped_column(Enum(*ROLES, name="rol"), primary_key=True)
