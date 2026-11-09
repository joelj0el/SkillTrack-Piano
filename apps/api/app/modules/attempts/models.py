from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, func, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Intento(Base):
    """Resultado de un intento: sin video, audio ni series de puntos de la mano."""

    __tablename__ = "intento"
    __table_args__ = (
        Index("ix_intento_estudiante_fecha", "estudiante_id", text("iniciado_en DESC")),
        Index(
            "ix_intento_tarea_cuenta",
            "tarea_id",
            "iniciado_en",
            postgresql_where=text("cuenta_para_tarea"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    client_uuid: Mapped[str] = mapped_column(UUID(as_uuid=False), unique=True)
    estudiante_id: Mapped[int] = mapped_column(ForeignKey("usuario.id", ondelete="CASCADE"))
    version_ejercicio_id: Mapped[int] = mapped_column(ForeignKey("version_ejercicio.id"))
    tarea_id: Mapped[int | None] = mapped_column(ForeignKey("tarea.id", ondelete="SET NULL"))
    referencia_id: Mapped[int | None] = mapped_column(Integer)
    conjunto_reglas_id: Mapped[int | None] = mapped_column(Integer)
    modelo_clasificador_id: Mapped[int | None] = mapped_column(Integer)
    version_nucleo: Mapped[str] = mapped_column(String(32))
    version_modelo_mano: Mapped[str] = mapped_column(String(64))
    instrumento: Mapped[str] = mapped_column(String(16))
    manos: Mapped[str] = mapped_column(String(8))
    clase_dispositivo: Mapped[str] = mapped_column(String(40))
    modo: Mapped[str] = mapped_column(String(2))
    modo_metronomo: Mapped[str | None] = mapped_column(String(4))
    tempo_elegido_bpm: Mapped[int | None] = mapped_column(Integer)
    tempo_medido_bpm: Mapped[float | None] = mapped_column(Float)
    estado: Mapped[str] = mapped_column(String(16))
    motivo_no_evaluable: Mapped[str | None] = mapped_column(String(120))
    cuenta_para_tarea: Mapped[bool] = mapped_column(Boolean)
    motivo_no_cuenta: Mapped[str | None] = mapped_column(String(120))
    iniciado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    recibido_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    duracion_ms: Mapped[int] = mapped_column(Integer)
    pct_eventos_evaluables: Mapped[float | None] = mapped_column(Float)
    pct_digitacion_correcta: Mapped[float | None] = mapped_column(Float)
    eventos: Mapped[list[dict]] = mapped_column(JSONB)


class Diagnostico(Base):
    """Se llena desde la It-4 (reglas); en la It-2 el estudiante no ve diagnósticos."""

    __tablename__ = "diagnostico"

    id: Mapped[int] = mapped_column(primary_key=True)
    intento_id: Mapped[int] = mapped_column(ForeignKey("intento.id", ondelete="CASCADE"))
    clase_error_id: Mapped[int] = mapped_column(ForeignKey("clase_error.id"))
    indicador_id: Mapped[int | None] = mapped_column(Integer)
    origen: Mapped[str] = mapped_column(String(16))
    version_origen: Mapped[str] = mapped_column(String(32))
    eventos_evidencia: Mapped[list[int]] = mapped_column(ARRAY(Integer))
    confianza: Mapped[float | None] = mapped_column(Float)
