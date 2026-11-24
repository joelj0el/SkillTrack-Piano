"""Pago por QR de una suscripción, desacoplado del banco (ADR-004).

El servicio solo conoce la interfaz `PasarelaQr`. Las pruebas usan `PasarelaSimulada`; el
adaptador del Banco Económico se agrega cuando exista su documentación técnica, leyendo las
credenciales solo de variables de entorno. Sin dirección pública en local, el estado se consulta
cada pocos segundos (`consultar_pago`) en lugar de esperar un aviso del banco.
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from itertools import count
from typing import Literal, Protocol

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.modules.plans.models import PagoQr, Plan, Suscripcion

EstadoBanco = Literal["pendiente", "pagado", "vencido", "anulado"]


@dataclass(frozen=True)
class QrGenerado:
    id_transaccion: str
    # Imagen del QR tal como la entrega el banco (p. ej. PNG en base64).
    imagen: str
    vence_en: datetime


class PasarelaQr(Protocol):
    def generar_qr(self, *, monto_bs: Decimal, glosa: str, referencia: str) -> QrGenerado: ...

    def consultar(self, id_transaccion: str) -> EstadoBanco: ...


class PasarelaNoDisponible(Exception):
    """No hay adaptador del banco configurado: el pago por QR está en integración."""


class SinPrecio(Exception):
    """El plan no tiene precio definido: no se puede cobrar."""


class PasarelaSimulada:
    """Adaptador para pruebas y desarrollo: nunca llama al banco."""

    def __init__(self) -> None:
        self._estados: dict[str, EstadoBanco] = {}
        self._siguiente = count(1)

    def generar_qr(self, *, monto_bs: Decimal, glosa: str, referencia: str) -> QrGenerado:
        id_transaccion = f"SIM-{next(self._siguiente):06d}"
        self._estados[id_transaccion] = "pendiente"
        return QrGenerado(id_transaccion, "QR SIMULADO", datetime(2100, 1, 1))

    def consultar(self, id_transaccion: str) -> EstadoBanco:
        return self._estados[id_transaccion]

    def marcar(self, id_transaccion: str, estado: EstadoBanco) -> None:
        self._estados[id_transaccion] = estado


DURACION = {"mensual": timedelta(days=30), "anual": timedelta(days=365)}


def iniciar_pago(
    db: Session,
    pasarela: PasarelaQr | None,
    suscripcion: Suscripcion,
    instante: datetime,
) -> tuple[PagoQr, QrGenerado]:
    if pasarela is None:
        raise PasarelaNoDisponible
    plan = db.get(Plan, suscripcion.plan_id)
    if plan is None or plan.precio_bs is None or plan.precio_bs <= 0:
        raise SinPrecio
    qr = pasarela.generar_qr(
        monto_bs=plan.precio_bs,
        glosa=f"SkillTrack-Piano · {plan.nombre} ({plan.periodo})",
        referencia=f"suscripcion-{suscripcion.id}",
    )
    pago = PagoQr(
        suscripcion_id=suscripcion.id,
        monto_bs=plan.precio_bs,
        id_transaccion=qr.id_transaccion,
        estado="pendiente",
        creado_en=instante,
    )
    db.add(pago)
    db.flush()
    return pago, qr


def consultar_pago(
    db: Session, pasarela: PasarelaQr, pago_id: int, hoy: date, instante: datetime
) -> str:
    """Consulta el banco y, si el pago se confirmó, activa la suscripción una sola vez."""
    pago = db.get(PagoQr, pago_id)
    if pago is None:
        raise LookupError(pago_id)
    estado = pasarela.consultar(pago.id_transaccion)
    if estado == "pagado":
        confirmar_pago(db, pago.id, hoy, instante)
    elif estado in ("vencido", "anulado") and pago.estado == "pendiente":
        pago.estado = estado
    db.commit()
    db.refresh(pago)
    return pago.estado


def confirmar_pago(db: Session, pago_id: int, hoy: date, instante: datetime) -> bool:
    """Idempotente: solo la transición pendiente → pagado activa la suscripción.

    El UPDATE condicional hace que dos confirmaciones (también concurrentes) activen una vez.
    Devuelve True si esta llamada fue la que activó."""
    fila = db.execute(
        update(PagoQr)
        .where(PagoQr.id == pago_id, PagoQr.estado == "pendiente")
        .values(estado="pagado", confirmado_en=instante)
        .returning(PagoQr.suscripcion_id)
    ).first()
    if fila is None:
        return False
    suscripcion = db.scalars(
        select(Suscripcion).where(Suscripcion.id == fila.suscripcion_id).with_for_update()
    ).one()
    plan = db.get(Plan, suscripcion.plan_id)
    # Una renovación sobre una suscripción activa se suma a su fin; si no, empieza hoy.
    renovacion = suscripcion.estado == "activa" and suscripcion.fin is not None
    desde = max(hoy, suscripcion.fin) if renovacion else hoy
    if not renovacion:
        suscripcion.inicio = hoy
    suscripcion.estado = "activa"
    suscripcion.fin = desde + DURACION[plan.periodo if plan else "mensual"]
    db.flush()
    return True
