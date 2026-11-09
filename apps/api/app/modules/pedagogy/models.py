from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Tarea(Base):
    """El estado no se guarda: se calcula con cancelada_en y fecha_limite (una sola verdad)."""

    __tablename__ = "tarea"
    __table_args__ = (
        CheckConstraint("tempo_min_bpm <= tempo_max_bpm", name="tempo_ordenado"),
        CheckConstraint("tempo_min_bpm BETWEEN 60 AND 75", name="tempo_min_prm02"),
        CheckConstraint("tempo_max_bpm BETWEEN 60 AND 75", name="tempo_max_prm02"),
        CheckConstraint("repeticiones_por_dia BETWEEN 1 AND 20", name="repeticiones_prm20"),
        CheckConstraint("manos IN ('MI', 'MD', 'juntas')", name="manos_validas"),
        Index(
            "ix_tarea_estudiante_plazo",
            "estudiante_id",
            "fecha_limite",
            postgresql_where=text("cancelada_en IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    institucion_id: Mapped[int] = mapped_column(ForeignKey("institucion.id"))
    docente_id: Mapped[int] = mapped_column(ForeignKey("usuario.id"))
    estudiante_id: Mapped[int] = mapped_column(ForeignKey("usuario.id", ondelete="CASCADE"))
    ejercicio_id: Mapped[int] = mapped_column(ForeignKey("ejercicio.id"))
    manos: Mapped[str] = mapped_column(String(8))
    tempo_min_bpm: Mapped[int]
    tempo_max_bpm: Mapped[int]
    repeticiones_por_dia: Mapped[int]
    fecha_limite: Mapped[date] = mapped_column(Date)
    cancelada_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    creada_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actualizada_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Observacion(Base):
    __tablename__ = "observacion"
    __table_args__ = (
        CheckConstraint("char_length(texto) BETWEEN 1 AND 1000", name="texto_longitud"),
        # El intento se agrega en la It-2: por ahora la observación se ancla a una tarea.
        CheckConstraint("tarea_id IS NOT NULL", name="anclada"),
        Index("ix_observacion_tarea", "tarea_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    docente_id: Mapped[int] = mapped_column(ForeignKey("usuario.id"))
    estudiante_id: Mapped[int] = mapped_column(ForeignKey("usuario.id", ondelete="CASCADE"))
    tarea_id: Mapped[int | None] = mapped_column(ForeignKey("tarea.id", ondelete="CASCADE"))
    clase_error_id: Mapped[int | None] = mapped_column(ForeignKey("clase_error.id"))
    texto: Mapped[str] = mapped_column(Text)
    creada_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
