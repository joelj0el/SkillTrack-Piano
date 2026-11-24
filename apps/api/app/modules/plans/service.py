"""Planes, suscripciones y límites (ADR-004)."""

from dataclasses import dataclass
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.institutions.models import Membresia
from app.modules.plans.models import Plan, Suscripcion

ROLES_CON_LIMITE = {"docente": "docentes", "estudiante": "estudiantes"}


def planes(db: Session, *, solo_activos: bool) -> list[Plan]:
    consulta = select(Plan).order_by(Plan.orden, Plan.id)
    if solo_activos:
        consulta = consulta.where(Plan.activo)
    return list(db.scalars(consulta))


def suscripcion_vigente(db: Session, institucion_id: int, hoy: date) -> Suscripcion | None:
    """La suscripción activa de la institución (la más reciente), si su fin no pasó."""
    s = db.scalars(
        select(Suscripcion)
        .where(Suscripcion.institucion_id == institucion_id, Suscripcion.estado == "activa")
        .order_by(Suscripcion.id.desc())
    ).first()
    if s is None or (s.fin is not None and s.fin < hoy):
        return None
    return s


def ultima_suscripcion(db: Session, institucion_id: int) -> Suscripcion | None:
    return db.scalars(
        select(Suscripcion)
        .where(Suscripcion.institucion_id == institucion_id)
        .order_by(Suscripcion.id.desc())
    ).first()


@dataclass(frozen=True)
class Limites:
    docentes: int | None
    estudiantes: int | None


def limites(db: Session, suscripcion: Suscripcion | None) -> Limites:
    """El convenio especial reemplaza los límites del plan; null = sin definir (sin límite)."""
    if suscripcion is None:
        return Limites(None, None)
    plan = db.get(Plan, suscripcion.plan_id)
    if suscripcion.convenio:
        return Limites(suscripcion.limite_docentes, suscripcion.limite_estudiantes)
    return Limites(
        plan.limite_docentes if plan else None,
        plan.limite_estudiantes if plan else None,
    )


def miembros_con_rol(db: Session, institucion_id: int, rol: str) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Membresia)
        .where(Membresia.institucion_id == institucion_id, Membresia.rol == rol)
    )


class LimiteAlcanzado(Exception):
    def __init__(self, mensaje: str) -> None:
        super().__init__(mensaje)
        self.mensaje = mensaje


def verificar_limite(db: Session, institucion_id: int, rol: str, hoy: date) -> None:
    """Sin suscripción activa no hay límites (instituciones anteriores al cambio de alcance)."""
    if rol not in ROLES_CON_LIMITE:
        return
    suscripcion = suscripcion_vigente(db, institucion_id, hoy)
    if suscripcion is None:
        return
    limite = getattr(limites(db, suscripcion), ROLES_CON_LIMITE[rol])
    if limite is None:
        return
    usados = miembros_con_rol(db, institucion_id, rol)
    if usados >= limite:
        plan = db.get(Plan, suscripcion.plan_id)
        nombre = (
            "de tu convenio" if suscripcion.convenio else f"del plan {plan.nombre if plan else ''}"
        )
        raise LimiteAlcanzado(
            f"Llegaste al límite de {ROLES_CON_LIMITE[rol]} {nombre}: permite {limite} y ya "
            f"hay {usados}. Para agregar más, pide ampliar el plan al superadministrador."
        )
