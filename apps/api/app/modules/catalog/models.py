from sqlalchemy import ARRAY, Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Ejercicio(Base):
    __tablename__ = "ejercicio"

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(8), unique=True)
    nombre: Mapped[str] = mapped_column(String(120))
    fuente: Mapped[str] = mapped_column(String(120))
    variantes_manos: Mapped[list[str]] = mapped_column(ARRAY(String(8)))
    tonalidad: Mapped[str] = mapped_column(String(40))
    compas: Mapped[str] = mapped_column(String(8))
    figura: Mapped[str] = mapped_column(String(40))
    orden: Mapped[int] = mapped_column(Integer)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


class VersionEjercicio(Base):
    """Versión inmutable: un cambio de partitura o de tempo crea una versión nueva."""

    __tablename__ = "version_ejercicio"
    __table_args__ = (UniqueConstraint("ejercicio_id", "version"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    ejercicio_id: Mapped[int] = mapped_column(ForeignKey("ejercicio.id"))
    version: Mapped[int] = mapped_column(Integer)
    tempo_min_permitido_bpm: Mapped[int] = mapped_column(Integer)
    tempo_max_permitido_bpm: Mapped[int] = mapped_column(Integer)
    rango_octavas: Mapped[int] = mapped_column(Integer)
    nota_min_midi: Mapped[int | None] = mapped_column(Integer)
    nota_max_midi: Mapped[int | None] = mapped_column(Integer)
    eventos_esperados: Mapped[list[dict]] = mapped_column(JSONB)
    partitura_svg: Mapped[str | None] = mapped_column(Text)


class ClaseError(Base):
    """Nivel 1 de la taxonomía; una fila publicada no se edita (versión nueva = filas nuevas)."""

    __tablename__ = "clase_error"
    __table_args__ = (UniqueConstraint("codigo", "version_taxonomia"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(8))
    nombre_pedagogico: Mapped[str] = mapped_column(String(120))
    variable_estudiante: Mapped[str] = mapped_column(String(80))
    definicion: Mapped[str | None] = mapped_column(Text)
    modalidad: Mapped[str] = mapped_column(String(2))
    version_taxonomia: Mapped[str] = mapped_column(String(16))
