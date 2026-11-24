"""Planes, suscripciones por institución, solicitudes de acceso y pagos por QR (ADR-004)."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

PERIODOS = ("mensual", "anual")
ESTADOS_SUSCRIPCION = ("pendiente", "activa", "vencida", "cancelada")
ESTADOS_PAGO = ("pendiente", "pagado", "vencido", "anulado")


class Plan(Base):
    """Un precio o un límite vacío es "sin definir" (se muestra "—")."""

    __tablename__ = "plan"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(80), unique=True)
    descripcion: Mapped[str] = mapped_column(String(240))
    beneficios: Mapped[list[str]] = mapped_column(ARRAY(String(160)))
    precio_bs: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    periodo: Mapped[str] = mapped_column(String(8))
    limite_docentes: Mapped[int | None] = mapped_column(Integer)
    limite_estudiantes: Mapped[int | None] = mapped_column(Integer)
    destacado: Mapped[bool] = mapped_column(Boolean, default=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    orden: Mapped[int] = mapped_column(Integer, default=0)


class Suscripcion(Base):
    """Plan de una institución; un convenio especial reemplaza los límites del plan."""

    __tablename__ = "suscripcion"
    __table_args__ = (
        Index("ix_suscripcion_institucion", "institucion_id", "estado"),
        Index("ix_suscripcion_convenio_codigo", "convenio_codigo_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    institucion_id: Mapped[int] = mapped_column(ForeignKey("institucion.id", ondelete="CASCADE"))
    plan_id: Mapped[int] = mapped_column(ForeignKey("plan.id"))
    estado: Mapped[str] = mapped_column(String(10))
    inicio: Mapped[date | None] = mapped_column(Date)
    fin: Mapped[date | None] = mapped_column(Date)
    convenio: Mapped[bool] = mapped_column(Boolean, default=False)
    condiciones: Mapped[str | None] = mapped_column(Text)
    limite_docentes: Mapped[int | None] = mapped_column(Integer)
    limite_estudiantes: Mapped[int | None] = mapped_column(Integer)
    # Convenio con código usado en el registro (ADR-005): fija el precio de la suscripción.
    convenio_codigo_id: Mapped[int | None] = mapped_column(ForeignKey("convenio_codigo.id"))
    creada_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ConvenioCodigo(Base):
    """Convenio con código (ADR-005): plan, precio especial (0 = sin pago), cupos y vencimiento."""

    __tablename__ = "convenio_codigo"
    __table_args__ = (
        CheckConstraint("precio_bs >= 0", name="precio_convenio_no_negativo"),
        CheckConstraint("cupos > 0", name="cupos_positivos"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(32), unique=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plan.id"))
    precio_bs: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    cupos: Mapped[int] = mapped_column(Integer)
    vence: Mapped[date] = mapped_column(Date)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SolicitudAcceso(Base):
    """Pedido de información o de acceso desde la página de inicio (sin sesión)."""

    __tablename__ = "solicitud_acceso"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120))
    institucion: Mapped[str] = mapped_column(String(160))
    correo: Mapped[str] = mapped_column(String(254))
    telefono: Mapped[str | None] = mapped_column(String(20))
    plan_id: Mapped[int | None] = mapped_column(ForeignKey("plan.id", ondelete="SET NULL"))
    mensaje: Mapped[str | None] = mapped_column(Text)
    creada_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    atendida: Mapped[bool] = mapped_column(Boolean, default=False)


class PagoQr(Base):
    """Cobro por QR de una suscripción. `id_transaccion` es el identificador del banco."""

    __tablename__ = "pago_qr"
    __table_args__ = (CheckConstraint("monto_bs > 0", name="monto_positivo"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    suscripcion_id: Mapped[int] = mapped_column(ForeignKey("suscripcion.id", ondelete="CASCADE"))
    monto_bs: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    id_transaccion: Mapped[str] = mapped_column(String(80), unique=True)
    estado: Mapped[str] = mapped_column(String(10))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    confirmado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
