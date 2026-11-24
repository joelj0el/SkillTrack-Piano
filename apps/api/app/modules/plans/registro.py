"""Registro de compradores (ADR-005): docente independiente o institución, adultos.

Crea la institución, su suscripción pendiente de pago y el usuario administrador (en un docente
independiente, también docente). Los estudiantes no se registran solos: los crea el administrador
o el docente. No se guardan datos de tarjeta.
"""

from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.contracts_gen.registro_nuevo import RegistroNuevo
from app.modules.audit import service as auditoria
from app.modules.identity.models import Usuario
from app.modules.identity.service import hash_clave
from app.modules.institutions import service as instituciones
from app.modules.institutions.models import Institucion
from app.modules.plans import pagos
from app.modules.plans.models import ConvenioCodigo, Plan, Suscripcion


class Duplicado(Exception):
    pass


class DatosNoValidos(Exception):
    """Plan no disponible o código de convenio vencido, agotado o inexistente."""


def usados(db: Session, convenio_id: int) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Suscripcion)
        .where(Suscripcion.convenio_codigo_id == convenio_id)
    )


def _convenio(db: Session, codigo: str, hoy: date) -> ConvenioCodigo:
    # Bloqueo de la fila: dos registros simultáneos no pueden usar el último cupo a la vez.
    convenio = db.scalars(
        select(ConvenioCodigo).where(ConvenioCodigo.codigo == codigo.upper()).with_for_update()
    ).first()
    if convenio is None:
        raise DatosNoValidos(
            "El código de convenio no existe. Revísalo o regístrate sin código eligiendo un plan."
        )
    if convenio.vence < hoy:
        raise DatosNoValidos(f"El código de convenio venció el {convenio.vence:%d/%m/%Y}.")
    if usados(db, convenio.id) >= convenio.cupos:
        raise DatosNoValidos("El código de convenio ya no tiene cupos disponibles.")
    return convenio


def _plan(db: Session, plan_id: int | None) -> Plan:
    if plan_id is None:
        raise DatosNoValidos("Elige un plan o escribe un código de convenio.")
    plan = db.get(Plan, plan_id)
    if plan is None or not plan.activo:
        raise DatosNoValidos("El plan elegido no está disponible. Elige otro plan.")
    return plan


def registrar(db: Session, datos: RegistroNuevo, hoy: date, instante: datetime) -> Usuario:
    if db.scalar(select(Usuario.id).where(Usuario.username == datos.usuario)) is not None:
        raise Duplicado("Ese nombre de usuario ya existe. Elige otro.")
    correo = datos.correo.strip()
    if db.scalar(select(Usuario.id).where(func.lower(Usuario.email) == correo.lower())) is not None:
        raise Duplicado("Ese correo ya está registrado. Inicia sesión o usa otro correo.")
    convenio = _convenio(db, datos.codigo_convenio, hoy) if datos.codigo_convenio else None
    plan = db.get(Plan, convenio.plan_id) if convenio else _plan(db, datos.plan_id)

    institucion = Institucion(nombre=datos.institucion)
    db.add(institucion)
    usuario = Usuario(
        username=datos.usuario,
        nombre_visible=datos.nombre,
        email=correo,
        telefono=datos.telefono,
        es_menor=False,
        hash_clave=hash_clave(datos.clave),
        # La eligió la persona: no hay clave temporal que cambiar.
        clave_temporal=False,
        terminos_aceptados_en=instante,
    )
    db.add(usuario)
    db.flush()
    instituciones.agregar_membresia(db, usuario.id, institucion.id, "admin_inst")
    if datos.tipo.value == "independiente":
        instituciones.agregar_membresia(db, usuario.id, institucion.id, "docente")
    suscripcion = Suscripcion(
        institucion_id=institucion.id,
        plan_id=plan.id,
        estado="pendiente",
        convenio=False,
        convenio_codigo_id=convenio.id if convenio else None,
    )
    db.add(suscripcion)
    db.flush()
    # Un convenio (o un plan) con precio 0 no se cobra: la cuenta queda activa.
    monto = pagos.monto_de(db, suscripcion)
    if monto is not None and monto == 0:
        pagos.activar(db, suscripcion, hoy)
    auditoria.registrar(
        db,
        actor_id=usuario.id,
        accion="registro",
        recurso="institucion",
        recurso_id=institucion.id,
        fecha=instante,
    )
    db.commit()
    return usuario
