"""Pago por QR de una suscripción, desacoplado del proveedor (ADR-004).

El servicio solo conoce la interfaz `PasarelaQr`. El proveedor se elige con PAGOS_PROVEEDOR:
`simulado` (predeterminado, nunca llama al banco) o `baneco` (adaptador del Banco Económico).
Un único camino activa el plan: `confirmar_pago`, con un UPDATE condicional (pendiente → pagado),
lo use la consulta del estado, el aviso del banco o el superadministrador.
"""

import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Literal, Protocol
from uuid import uuid4

from fastapi import Request
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.reloj import hoy_local
from app.modules.plans.models import ConvenioCodigo, PagoQr, Plan, Suscripcion

registro = logging.getLogger("app.pagos")

EstadoBanco = Literal["pendiente", "pagado", "anulado"]
MONEDA = "BOB"
# Como mucho una consulta al banco cada 5 s por pago.
INTERVALO_CONSULTA = timedelta(seconds=5)


@dataclass(frozen=True)
class QrGenerado:
    id_transaccion: str
    qr_id: str
    # PNG en Base64 tal como lo entrega el banco; None en el simulado. Nunca se guarda ni se
    # escribe en el registro.
    imagen: str | None
    vence: date


@dataclass(frozen=True)
class PagoRecibido:
    """Un pago informado por el banco. Solo se leen estos campos: nada de quien paga."""

    qr_id: str
    monto: Decimal
    moneda: str
    fecha: str | None
    hora: str | None


@dataclass(frozen=True)
class EstadoQr:
    estado: EstadoBanco
    pagos: tuple[PagoRecibido, ...] = ()


class PasarelaQr(Protocol):
    proveedor: Literal["simulado", "baneco"]

    def generar_qr(
        self, *, id_transaccion: str, monto_bs: Decimal, descripcion: str, vence: date
    ) -> QrGenerado: ...

    def consultar(self, qr_id: str) -> EstadoQr: ...

    def cancelar(self, qr_id: str) -> None: ...


class PasarelaNoDisponible(Exception):
    """No hay proveedor de pagos configurado."""


class BancoNoDisponible(Exception):
    """El banco no respondió o respondió con error. El mensaje solo lleva la operación, el código
    HTTP y el responseCode: nunca cuerpos, llaves, cuentas ni tokens."""


class SinPrecio(Exception):
    """El plan no tiene precio definido: no se puede cobrar."""


class PasarelaSimulada:
    """Proveedor para pruebas y desarrollo: nunca llama al banco."""

    proveedor: Literal["simulado", "baneco"] = "simulado"

    def __init__(self) -> None:
        self._estados: dict[str, EstadoBanco] = {}
        self._montos: dict[str, Decimal] = {}

    def generar_qr(
        self, *, id_transaccion: str, monto_bs: Decimal, descripcion: str, vence: date
    ) -> QrGenerado:
        self._estados[id_transaccion] = "pendiente"
        self._montos[id_transaccion] = monto_bs
        return QrGenerado(id_transaccion, id_transaccion, None, vence)

    def consultar(self, qr_id: str) -> EstadoQr:
        # Tras reiniciar la API el simulado olvida sus QR: siguen pendientes.
        estado = self._estados.get(qr_id, "pendiente")
        if estado != "pagado":
            return EstadoQr(estado)
        monto = self._montos.get(qr_id, Decimal("0"))
        return EstadoQr("pagado", (PagoRecibido(qr_id, monto, MONEDA, None, None),))

    def cancelar(self, qr_id: str) -> None:
        self._estados[qr_id] = "anulado"

    def marcar(self, id_transaccion: str, estado: EstadoBanco) -> None:
        self._estados[id_transaccion] = estado


DURACION = {"mensual": timedelta(days=30), "anual": timedelta(days=365)}


def pasarela_vigente(request: Request) -> PasarelaQr:
    """Dependencia de FastAPI: el proveedor que la aplicación eligió al arrancar."""
    return request.app.state.pasarela


def es_simulada(pasarela: PasarelaQr) -> bool:
    return pasarela.proveedor == "simulado"


def nuevo_id_transaccion() -> str:
    """Nuestro id del pago, aleatorio: tras reiniciar la API no choca con los ya guardados."""
    return f"ST-{uuid4().hex[:16].upper()}"


def monto_de(db: Session, suscripcion: Suscripcion) -> Decimal | None:
    """El precio del convenio con código, si lo hay; si no, el del plan (None = sin definir)."""
    if suscripcion.convenio_codigo_id is not None:
        convenio = db.get(ConvenioCodigo, suscripcion.convenio_codigo_id)
        return convenio.precio_bs if convenio else None
    plan = db.get(Plan, suscripcion.plan_id)
    return plan.precio_bs if plan else None


def pago_pendiente_de(db: Session, suscripcion_id: int) -> PagoQr | None:
    return db.scalars(
        select(PagoQr)
        .where(PagoQr.suscripcion_id == suscripcion_id, PagoQr.estado == "pendiente")
        .order_by(PagoQr.id.desc())
    ).first()


def ultimo_pago_sin_confirmar(db: Session, suscripcion_id: int) -> PagoQr | None:
    """El QR más reciente que no se pagó (pendiente, vencido o anulado), para mostrarlo."""
    return db.scalars(
        select(PagoQr)
        .where(PagoQr.suscripcion_id == suscripcion_id, PagoQr.estado != "pagado")
        .order_by(PagoQr.id.desc())
    ).first()


def iniciar_pago(
    db: Session,
    pasarela: PasarelaQr | None,
    suscripcion: Suscripcion,
    instante: datetime,
) -> tuple[PagoQr, QrGenerado]:
    """Genera el QR del monto del plan (o del convenio), que vence mañana en hora de La Paz."""
    if pasarela is None:
        raise PasarelaNoDisponible
    plan = db.get(Plan, suscripcion.plan_id)
    monto = monto_de(db, suscripcion)
    if plan is None or monto is None or monto <= 0:
        raise SinPrecio
    qr = pasarela.generar_qr(
        id_transaccion=nuevo_id_transaccion(),
        monto_bs=monto,
        descripcion=f"SkillTrack-Piano – Plan {plan.nombre}",
        vence=hoy_local(instante) + timedelta(days=1),
    )
    pago = PagoQr(
        suscripcion_id=suscripcion.id,
        monto_bs=monto,
        moneda=MONEDA,
        id_transaccion=qr.id_transaccion,
        qr_id=qr.qr_id,
        estado="pendiente",
        vence=qr.vence,
        creado_en=instante,
    )
    db.add(pago)
    db.flush()
    return pago, qr


def toca_consultar(pago: PagoQr, instante: datetime) -> bool:
    return pago.consultado_en is None or instante - pago.consultado_en >= INTERVALO_CONSULTA


def consultar_pago(
    db: Session, pasarela: PasarelaQr, pago_id: int, hoy: date, instante: datetime
) -> str:
    """Consulta el estado del QR y, si el banco confirma el pago, activa el plan una sola vez.

    Pagado = el QR figura pagado y entre sus pagos hay uno con el mismo qrId, el monto esperado y
    BOB. Si el monto o la moneda no coinciden, el plan no se activa."""
    pago = db.get(PagoQr, pago_id)
    if pago is None:
        raise LookupError(pago_id)
    if pago.estado != "pendiente":
        return pago.estado
    if pago.vence is not None and hoy > pago.vence:
        pago.estado = "vencido"
        db.commit()
        return pago.estado
    pago.consultado_en = instante
    qr_id = pago.qr_id or pago.id_transaccion
    estado = pasarela.consultar(qr_id)
    if estado.estado == "pagado":
        recibido = next(
            (
                p
                for p in estado.pagos
                if p.qr_id == qr_id and p.monto == pago.monto_bs and p.moneda == pago.moneda
            ),
            None,
        )
        if recibido is None:
            registro.warning("Pago %s: el QR figura pagado sin un pago que coincida", pago.id)
        else:
            pago.fecha_pago = recibido.fecha
            pago.hora_pago = recibido.hora
            confirmar_pago(db, pago.id, hoy, instante)
    elif estado.estado == "anulado":
        pago.estado = "anulado"
    db.commit()
    db.refresh(pago)
    return pago.estado


def cancelar_pago(db: Session, pasarela: PasarelaQr, pago: PagoQr) -> None:
    pasarela.cancelar(pago.qr_id or pago.id_transaccion)
    db.execute(
        update(PagoQr)
        .where(PagoQr.id == pago.id, PagoQr.estado == "pendiente")
        .values(estado="anulado")
    )
    db.commit()


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
    activar(db, suscripcion, hoy)
    return True


def activar(db: Session, suscripcion: Suscripcion, hoy: date) -> None:
    """Activa por un periodo del plan. Una renovación sobre una suscripción activa se suma a su
    fin; si no, empieza hoy."""
    plan = db.get(Plan, suscripcion.plan_id)
    renovacion = suscripcion.estado == "activa" and suscripcion.fin is not None
    desde = max(hoy, suscripcion.fin) if renovacion else hoy
    if not renovacion:
        suscripcion.inicio = hoy
    suscripcion.estado = "activa"
    suscripcion.fin = desde + DURACION[plan.periodo if plan else "mensual"]
    db.flush()


def activar_por_superadmin(db: Session, suscripcion_id: int, hoy: date, instante: datetime) -> bool:
    """El superadministrador verificó el pago: activa una sola vez una suscripción pendiente.

    Los QR pendientes quedan pagados, así una confirmación posterior del banco no la vuelve a
    extender. Devuelve False si ya estaba activa."""
    suscripcion = db.scalars(
        select(Suscripcion).where(Suscripcion.id == suscripcion_id).with_for_update()
    ).first()
    if suscripcion is None:
        raise LookupError(suscripcion_id)
    if suscripcion.estado == "activa":
        return False
    db.execute(
        update(PagoQr)
        .where(PagoQr.suscripcion_id == suscripcion_id, PagoQr.estado == "pendiente")
        .values(estado="pagado", confirmado_en=instante)
    )
    activar(db, suscripcion, hoy)
    return True
