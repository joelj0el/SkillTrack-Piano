"""Rutas de planes, suscripciones, registro de compradores y pago (ADR-004, ADR-005).

Públicas (sin sesión, en RUTAS_PUBLICAS): la lista de planes activos, el envío de una solicitud
de acceso y el registro de un comprador; las dos que escriben tienen un límite por minuto e IP.
Todo lo demás exige sesión: la gestión es del superadministrador, "Mi plan" del administrador de
la institución y "Mi pago" del administrador de una cuenta pendiente de pago.
"""

import logging
from datetime import date, datetime, time
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select

from app.contracts_gen.aviso_pago_qr import AvisoPagoQr
from app.contracts_gen.convenio_codigo import ConvenioCodigo as ConvenioDto
from app.contracts_gen.convenio_codigo_nuevo import ConvenioCodigoNuevo
from app.contracts_gen.cuenta_pendiente import CuentaPendiente
from app.contracts_gen.institucion_creada import InstitucionCreada
from app.contracts_gen.institucion_listada import InstitucionListada
from app.contracts_gen.institucion_nueva import InstitucionNueva
from app.contracts_gen.mi_pago import MiPago, QrDePago
from app.contracts_gen.mi_plan import MiPlan
from app.contracts_gen.plan import Plan as PlanDto
from app.contracts_gen.plan_cambio import PlanCambio
from app.contracts_gen.plan_nuevo import PlanNuevo
from app.contracts_gen.registro_nuevo import RegistroNuevo
from app.contracts_gen.respuesta_aviso_qr import RespuestaAvisoQr
from app.contracts_gen.solicitud_acceso import SolicitudAcceso as SolicitudDto
from app.contracts_gen.solicitud_acceso_nueva import SolicitudAccesoNueva
from app.contracts_gen.suscripcion import Suscripcion as SuscripcionDto
from app.contracts_gen.suscripcion_cambio import SuscripcionCambio
from app.contracts_gen.suscripcion_nueva import SuscripcionNueva
from app.contracts_gen.usuario_actual import UsuarioActual
from app.core.config_pagos import ConfiguracionPagos
from app.core.limite_ip import ip_del_cliente, limitar_por_ip
from app.core.reloj import ZONA_LOCAL, hoy_local
from app.modules.audit import service as auditoria
from app.modules.identity import service as identidad
from app.modules.identity.deps import Superadmin, UsuarioEnSesion
from app.modules.identity.models import Usuario
from app.modules.identity.router import abrir_sesion, usuario_actual
from app.modules.institutions import service as instituciones
from app.modules.institutions.deps import AdminDeInstitucion, Ahora, Db
from app.modules.institutions.models import Institucion, Membresia
from app.modules.plans import pagos, registro, service
from app.modules.plans.baneco import campo as campo_del_banco
from app.modules.plans.models import ConvenioCodigo, PagoQr, Plan, SolicitudAcceso, Suscripcion

registro_api = logging.getLogger("app.pagos")

publico = APIRouter(tags=["plans"])
router = APIRouter(tags=["plans"])


def _centavos(valor: float) -> Decimal:
    return Decimal(str(valor)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


NO_ENCONTRADO = HTTPException(status.HTTP_404_NOT_FOUND, "No encontrado")
Pasarela = Annotated[pagos.PasarelaQr, Depends(pagos.pasarela_vigente)]


def _plan(p: Plan) -> PlanDto:
    return PlanDto(
        id=p.id,
        nombre=p.nombre,
        descripcion=p.descripcion,
        beneficios=list(p.beneficios),
        precio_bs=float(p.precio_bs) if p.precio_bs is not None else None,
        periodo=p.periodo,
        limite_docentes=p.limite_docentes,
        limite_estudiantes=p.limite_estudiantes,
        destacado=p.destacado,
        activo=p.activo,
    )


def _suscripcion(db: Db, s: Suscripcion) -> SuscripcionDto:
    return SuscripcionDto(
        id=s.id,
        institucion_id=s.institucion_id,
        institucion=db.get(Institucion, s.institucion_id).nombre,
        plan=db.get(Plan, s.plan_id).nombre,
        plan_id=s.plan_id,
        estado=s.estado,
        inicio=s.inicio,
        fin=s.fin,
        convenio=s.convenio,
        condiciones=s.condiciones,
        limite_docentes=s.limite_docentes,
        limite_estudiantes=s.limite_estudiantes,
    )


def _solicitud(db: Db, s: SolicitudAcceso) -> SolicitudDto:
    plan = db.get(Plan, s.plan_id) if s.plan_id else None
    return SolicitudDto(
        id=s.id,
        nombre=s.nombre,
        institucion=s.institucion,
        correo=s.correo,
        telefono=s.telefono,
        plan_id=s.plan_id,
        mensaje=s.mensaje,
        plan=plan.nombre if plan else None,
        creada_en=s.creada_en,
        atendida=s.atendida,
    )


# --- Públicas ---------------------------------------------------------------------------------


@publico.get("/planes", response_model=list[PlanDto])
def planes_activos(db: Db) -> list[PlanDto]:
    return [_plan(p) for p in service.planes(db, solo_activos=True)]


@publico.post(
    "/solicitudes-acceso",
    status_code=status.HTTP_201_CREATED,
    response_model=None,
    dependencies=[Depends(limitar_por_ip)],
)
def solicitar_acceso(datos: SolicitudAccesoNueva, db: Db, instante: Ahora) -> None:
    if datos.plan_id is not None:
        plan = db.get(Plan, datos.plan_id)
        if plan is None or not plan.activo:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "plan_id: no existe")
    db.add(
        SolicitudAcceso(
            nombre=datos.nombre,
            institucion=datos.institucion,
            correo=datos.correo,
            telefono=datos.telefono,
            plan_id=datos.plan_id,
            mensaje=datos.mensaje,
            creada_en=instante,
        )
    )
    db.commit()


@publico.post(
    "/registro",
    status_code=status.HTTP_201_CREATED,
    response_model=UsuarioActual,
    dependencies=[Depends(limitar_por_ip)],
)
def registrar(datos: RegistroNuevo, respuesta: Response, db: Db, instante: Ahora) -> UsuarioActual:
    """Registro de un comprador adulto; abre la sesión (pendiente de pago si hay que pagar)."""
    try:
        usuario = registro.registrar(db, datos, hoy_local(instante), instante)
    except registro.Duplicado as error:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from None
    except registro.DatosNoValidos as error:
        db.rollback()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from None
    abrir_sesion(db, usuario, respuesta, instante)
    return usuario_actual(db, usuario, instante)


# --- Superadministrador -----------------------------------------------------------------------


@router.get("/admin/planes", response_model=list[PlanDto])
def todos_los_planes(_: Superadmin, db: Db) -> list[PlanDto]:
    return [_plan(p) for p in service.planes(db, solo_activos=False)]


@router.post("/admin/planes", response_model=PlanDto, status_code=status.HTTP_201_CREATED)
def crear_plan(datos: PlanNuevo, _: Superadmin, db: Db) -> PlanDto:
    if db.scalar(select(Plan.id).where(Plan.nombre == datos.nombre)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un plan con ese nombre")
    valores = datos.model_dump()
    if valores["precio_bs"] is not None:
        valores["precio_bs"] = _centavos(valores["precio_bs"])
    plan = Plan(**valores, orden=len(service.planes(db, solo_activos=False)))
    db.add(plan)
    db.commit()
    return _plan(plan)


@router.patch("/admin/planes/{plan_id}", response_model=PlanDto)
def cambiar_plan(plan_id: int, datos: PlanCambio, _: Superadmin, db: Db) -> PlanDto:
    plan = db.get(Plan, plan_id)
    if plan is None:
        raise NO_ENCONTRADO
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        if campo == "precio_bs" and valor is not None:
            valor = _centavos(valor)
        setattr(plan, campo, valor)
    db.commit()
    return _plan(plan)


@router.get("/admin/instituciones", response_model=list[InstitucionListada])
def listar_instituciones(_: Superadmin, db: Db) -> list[InstitucionListada]:
    filas = db.scalars(select(Institucion).order_by(Institucion.nombre, Institucion.id))
    return [InstitucionListada(id=i.id, nombre=i.nombre, activo=i.activo) for i in filas]


@router.post(
    "/admin/instituciones",
    response_model=InstitucionCreada,
    status_code=status.HTTP_201_CREATED,
)
def crear_institucion(
    datos: InstitucionNueva, actor: Superadmin, db: Db, instante: Ahora
) -> InstitucionCreada:
    """Crea la institución con su administrador. Un docente independiente también es docente."""
    institucion = Institucion(nombre=datos.nombre)
    db.add(institucion)
    db.flush()
    try:
        usuario, clave = identidad.crear_usuario(
            db,
            username=datos.admin_usuario,
            nombre_visible=datos.admin_nombre,
            email=datos.admin_email,
            es_menor=False,
        )
    except identidad.UsuarioDuplicado:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Ese nombre de usuario ya existe") from None
    instituciones.agregar_membresia(db, usuario.id, institucion.id, "admin_inst")
    if datos.independiente:
        instituciones.agregar_membresia(db, usuario.id, institucion.id, "docente")
    auditoria.registrar(
        db,
        actor_id=actor.id,
        accion="crear_institucion",
        recurso="institucion",
        recurso_id=institucion.id,
        fecha=instante,
    )
    db.commit()
    return InstitucionCreada(
        id=institucion.id, admin_usuario=usuario.username, clave_temporal=clave
    )


@router.get("/admin/suscripciones", response_model=list[SuscripcionDto])
def listar_suscripciones(_: Superadmin, db: Db) -> list[SuscripcionDto]:
    filas = db.scalars(select(Suscripcion).order_by(Suscripcion.id.desc()))
    return [_suscripcion(db, s) for s in filas]


def _validar_plan(db: Db, plan_id: int) -> None:
    if db.get(Plan, plan_id) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "plan_id: no existe")


@router.post(
    "/admin/suscripciones",
    response_model=SuscripcionDto,
    status_code=status.HTTP_201_CREATED,
)
def crear_suscripcion(datos: SuscripcionNueva, _: Superadmin, db: Db) -> SuscripcionDto:
    if db.get(Institucion, datos.institucion_id) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "institucion_id: no existe")
    _validar_plan(db, datos.plan_id)
    s = Suscripcion(**datos.model_dump(mode="python"))
    s.estado = datos.estado.value
    db.add(s)
    db.commit()
    return _suscripcion(db, s)


@router.patch("/admin/suscripciones/{suscripcion_id}", response_model=SuscripcionDto)
def cambiar_suscripcion(
    suscripcion_id: int, datos: SuscripcionCambio, _: Superadmin, db: Db
) -> SuscripcionDto:
    s = db.get(Suscripcion, suscripcion_id)
    if s is None:
        raise NO_ENCONTRADO
    cambios = datos.model_dump(exclude_unset=True, mode="python")
    if "plan_id" in cambios:
        _validar_plan(db, cambios["plan_id"])
    for campo, valor in cambios.items():
        setattr(s, campo, getattr(valor, "value", valor))
    db.commit()
    return _suscripcion(db, s)


@router.get("/admin/solicitudes-acceso", response_model=list[SolicitudDto])
def listar_solicitudes(_: Superadmin, db: Db) -> list[SolicitudDto]:
    filas = db.scalars(
        select(SolicitudAcceso).order_by(SolicitudAcceso.atendida, SolicitudAcceso.creada_en.desc())
    )
    return [_solicitud(db, s) for s in filas]


@router.post("/admin/solicitudes-acceso/{solicitud_id}/atender", response_model=SolicitudDto)
def atender_solicitud(solicitud_id: int, _: Superadmin, db: Db) -> SolicitudDto:
    s = db.get(SolicitudAcceso, solicitud_id)
    if s is None:
        raise NO_ENCONTRADO
    s.atendida = True
    db.commit()
    return _solicitud(db, s)


def _convenio(db: Db, c: ConvenioCodigo) -> ConvenioDto:
    return ConvenioDto(
        id=c.id,
        codigo=c.codigo,
        plan_id=c.plan_id,
        plan=db.get(Plan, c.plan_id).nombre,
        precio_bs=float(c.precio_bs),
        cupos=c.cupos,
        vence=c.vence,
        usados=registro.usados(db, c.id),
    )


@router.get("/admin/convenios", response_model=list[ConvenioDto])
def listar_convenios(_: Superadmin, db: Db) -> list[ConvenioDto]:
    filas = db.scalars(select(ConvenioCodigo).order_by(ConvenioCodigo.vence.desc()))
    return [_convenio(db, c) for c in filas]


@router.post("/admin/convenios", response_model=ConvenioDto, status_code=status.HTTP_201_CREATED)
def crear_convenio(datos: ConvenioCodigoNuevo, _: Superadmin, db: Db) -> ConvenioDto:
    _validar_plan(db, datos.plan_id)
    if db.scalar(select(ConvenioCodigo.id).where(ConvenioCodigo.codigo == datos.codigo)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un convenio con ese código")
    convenio = ConvenioCodigo(
        codigo=datos.codigo,
        plan_id=datos.plan_id,
        precio_bs=_centavos(datos.precio_bs),
        cupos=datos.cupos,
        vence=datos.vence,
    )
    db.add(convenio)
    db.commit()
    return _convenio(db, convenio)


def _administrador(db: Db, institucion_id: int) -> Usuario | None:
    return db.scalars(
        select(Usuario)
        .join(Membresia, Membresia.usuario_id == Usuario.id)
        .where(Membresia.institucion_id == institucion_id, Membresia.rol == "admin_inst")
        .order_by(Usuario.id)
    ).first()


def _monto(valor: Decimal | None) -> float | None:
    return float(valor) if valor is not None else None


@router.get("/admin/cuentas-pendientes", response_model=list[CuentaPendiente])
def cuentas_pendientes(_: Superadmin, db: Db, instante: Ahora) -> list[CuentaPendiente]:
    """Cuentas cuyo plan espera el pago, con el contacto de su administrador (ADR-005)."""
    hoy = hoy_local(instante)
    filas = db.scalars(
        select(Suscripcion).where(Suscripcion.estado == "pendiente").order_by(Suscripcion.id)
    )
    cuentas = []
    for s in filas:
        if not service.institucion_pendiente_de_pago(db, s.institucion_id, hoy):
            continue
        admin = _administrador(db, s.institucion_id)
        convenio = db.get(ConvenioCodigo, s.convenio_codigo_id) if s.convenio_codigo_id else None
        cuentas.append(
            CuentaPendiente(
                suscripcion_id=s.id,
                institucion=db.get(Institucion, s.institucion_id).nombre,
                plan=db.get(Plan, s.plan_id).nombre,
                monto_bs=_monto(pagos.monto_de(db, s)),
                codigo_convenio=convenio.codigo if convenio else None,
                nombre=admin.nombre_visible if admin else "—",
                usuario=admin.username if admin else "—",
                correo=admin.email if admin else None,
                telefono=admin.telefono if admin else None,
                creada_en=s.creada_en,
                qr_generado=pagos.pago_pendiente_de(db, s.id) is not None,
            )
        )
    return cuentas


@router.post("/admin/suscripciones/{suscripcion_id}/activar", response_model=SuscripcionDto)
def activar_suscripcion(
    suscripcion_id: int, actor: Superadmin, db: Db, instante: Ahora
) -> SuscripcionDto:
    """El superadministrador verificó el pago: activa una sola vez (idempotente)."""
    try:
        activada = pagos.activar_por_superadmin(db, suscripcion_id, hoy_local(instante), instante)
    except LookupError:
        raise NO_ENCONTRADO from None
    if activada:
        auditoria.registrar(
            db,
            actor_id=actor.id,
            accion="activar_suscripcion",
            recurso="suscripcion",
            recurso_id=suscripcion_id,
            fecha=instante,
        )
    db.commit()
    return _suscripcion(db, db.get(Suscripcion, suscripcion_id))


# --- Pago por QR: cuenta pendiente ("Mi pago") y renovación ("Mi plan") -----------------------


def _suscripcion_por_pagar(db: Db, usuario: Usuario, instante: datetime) -> Suscripcion:
    """La suscripción pendiente de una institución que el usuario administra.

    Un miembro que no la administra recibe 403; quien no tiene nada pendiente, 404."""
    hoy = hoy_local(instante)
    membresias = db.scalars(select(Membresia).where(Membresia.usuario_id == usuario.id)).all()
    pendientes = [
        m for m in membresias if service.institucion_pendiente_de_pago(db, m.institucion_id, hoy)
    ]
    administradas = [m for m in pendientes if m.rol == "admin_inst"]
    if administradas:
        return service.ultima_suscripcion(db, administradas[0].institucion_id)
    if pendientes:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Solo la administración de la institución paga el plan",
        )
    raise HTTPException(status.HTTP_404_NOT_FOUND, "No tienes un pago pendiente")


def _suscripcion_de_institucion(db: Db, institucion_id: int) -> Suscripcion:
    """Para renovar desde "Mi plan": la suscripción vigente o, si no hay, la última."""
    s = service.ultima_suscripcion(db, institucion_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "La institución no tiene un plan")
    return s


# Imagen del QR de cada transacción mientras la API está en marcha: no se guarda en la base ni se
# escribe en el registro.
_QR_GENERADOS: dict[str, pagos.QrGenerado] = {}

NO_SE_PUDO_GENERAR = "No pudimos generar el QR. Intenta de nuevo en unos minutos."


def _qr(pago: PagoQr, pasarela: pagos.PasarelaQr) -> QrDePago:
    simulado = pagos.es_simulada(pasarela)
    generado = _QR_GENERADOS.get(pago.id_transaccion)
    if pago.vence is not None:
        # Vence al terminar ese día en La Paz.
        vence_en = datetime.combine(pago.vence, time(23, 59, 59), ZONA_LOCAL)
    else:
        vence_en = pago.creado_en
    return QrDePago(
        id_transaccion=pago.id_transaccion,
        estado=pago.estado,
        simulado=simulado,
        imagen_png=generado.imagen if generado and not simulado else None,
        vence_en=vence_en,
    )


def _mi_pago(db: Db, s: Suscripcion, pasarela: pagos.PasarelaQr, hoy: date) -> MiPago:
    plan = db.get(Plan, s.plan_id)
    convenio = db.get(ConvenioCodigo, s.convenio_codigo_id) if s.convenio_codigo_id else None
    pago = pagos.ultimo_pago_sin_confirmar(db, s.id)
    # Un QR pendiente cuya fecha pasó se muestra vencido sin consultar al banco.
    if pago is not None and pago.estado == "pendiente" and pago.vence and hoy > pago.vence:
        pago.estado = "vencido"
        db.commit()
    return MiPago(
        institucion=db.get(Institucion, s.institucion_id).nombre,
        plan=plan.nombre,
        periodo=plan.periodo,
        monto_bs=_monto(pagos.monto_de(db, s)),
        codigo_convenio=convenio.codigo if convenio else None,
        estado=s.estado,
        vence_plan=s.fin if s.estado == "activa" else None,
        proveedor=pasarela.proveedor,
        qr=_qr(pago, pasarela) if pago else None,
    )


def _generar(db: Db, s: Suscripcion, pasarela: pagos.PasarelaQr, instante: datetime) -> MiPago:
    """Genera el QR del monto del plan (o del convenio); si ya hay uno pendiente, lo reutiliza."""
    hoy = hoy_local(instante)
    pendiente = pagos.pago_pendiente_de(db, s.id)
    if pendiente is not None and pendiente.vence and hoy > pendiente.vence:
        pendiente.estado = "vencido"
        db.commit()
        pendiente = None
    sin_imagen = pendiente is not None and pendiente.id_transaccion not in _QR_GENERADOS
    if sin_imagen and not pagos.es_simulada(pasarela):
        # La API se reinició y la imagen ya no está en memoria: se anula ese QR y se genera otro.
        try:
            pagos.cancelar_pago(db, pasarela, pendiente)
        except pagos.BancoNoDisponible as error:
            db.rollback()
            registro_api.warning("No se anuló el QR sin imagen: %s", error)
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, NO_SE_PUDO_GENERAR) from None
        pendiente = None
    if pendiente is None:
        try:
            pago, qr = pagos.iniciar_pago(db, pasarela, s, instante)
        except pagos.SinPrecio:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "El monto de tu plan todavía no está definido: el superadministrador verificará "
                "tu cuenta y la activará.",
            ) from None
        except pagos.BancoNoDisponible as error:
            db.rollback()
            registro_api.warning("No se generó el QR: %s", error)
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, NO_SE_PUDO_GENERAR) from None
        _QR_GENERADOS[pago.id_transaccion] = qr
        db.commit()
    return _mi_pago(db, s, pasarela, hoy)


def _verificar(db: Db, s: Suscripcion, pasarela: pagos.PasarelaQr, instante: datetime) -> MiPago:
    """Consulta al banco como mucho una vez cada 5 s por pago; si se pagó, activa una vez."""
    hoy = hoy_local(instante)
    pago = pagos.pago_pendiente_de(db, s.id)
    if pago is not None and pagos.toca_consultar(pago, instante):
        try:
            pagos.consultar_pago(db, pasarela, pago.id, hoy, instante)
        except pagos.BancoNoDisponible as error:
            # Sin respuesta del banco el pago sigue pendiente; se reintenta en la próxima consulta.
            db.rollback()
            registro_api.warning("No se consultó el estado del QR: %s", error)
        db.refresh(s)
    return _mi_pago(db, s, pasarela, hoy)


def _cancelar(db: Db, s: Suscripcion, pasarela: pagos.PasarelaQr, instante: datetime) -> MiPago:
    pago = pagos.pago_pendiente_de(db, s.id)
    if pago is not None:
        try:
            pagos.cancelar_pago(db, pasarela, pago)
        except pagos.BancoNoDisponible as error:
            db.rollback()
            registro_api.warning("No se anuló el QR: %s", error)
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "No pudimos anular el QR. Intenta de nuevo en unos minutos.",
            ) from None
    return _mi_pago(db, s, pasarela, hoy_local(instante))


@router.get("/mi-pago", response_model=MiPago)
def mi_pago(usuario: UsuarioEnSesion, db: Db, instante: Ahora, pasarela: Pasarela) -> MiPago:
    s = _suscripcion_por_pagar(db, usuario, instante)
    return _mi_pago(db, s, pasarela, hoy_local(instante))


@router.post("/mi-pago/qr", response_model=MiPago)
def generar_qr(usuario: UsuarioEnSesion, db: Db, instante: Ahora, pasarela: Pasarela) -> MiPago:
    return _generar(db, _suscripcion_por_pagar(db, usuario, instante), pasarela, instante)


@router.post("/mi-pago/verificar", response_model=MiPago)
def verificar_pago(usuario: UsuarioEnSesion, db: Db, instante: Ahora, pasarela: Pasarela) -> MiPago:
    return _verificar(db, _suscripcion_por_pagar(db, usuario, instante), pasarela, instante)


@router.post("/mi-pago/cancelar", response_model=MiPago)
def cancelar_qr(usuario: UsuarioEnSesion, db: Db, instante: Ahora, pasarela: Pasarela) -> MiPago:
    return _cancelar(db, _suscripcion_por_pagar(db, usuario, instante), pasarela, instante)


@router.get("/instituciones/{institucion_id}/pago", response_model=MiPago)
def pago_de_institucion(
    institucion_id: AdminDeInstitucion, db: Db, instante: Ahora, pasarela: Pasarela
) -> MiPago:
    s = _suscripcion_de_institucion(db, institucion_id)
    return _mi_pago(db, s, pasarela, hoy_local(instante))


@router.post("/instituciones/{institucion_id}/pago/qr", response_model=MiPago)
def generar_qr_de_institucion(
    institucion_id: AdminDeInstitucion, db: Db, instante: Ahora, pasarela: Pasarela
) -> MiPago:
    return _generar(db, _suscripcion_de_institucion(db, institucion_id), pasarela, instante)


@router.post("/instituciones/{institucion_id}/pago/verificar", response_model=MiPago)
def verificar_pago_de_institucion(
    institucion_id: AdminDeInstitucion, db: Db, instante: Ahora, pasarela: Pasarela
) -> MiPago:
    return _verificar(db, _suscripcion_de_institucion(db, institucion_id), pasarela, instante)


@router.post("/instituciones/{institucion_id}/pago/cancelar", response_model=MiPago)
def cancelar_qr_de_institucion(
    institucion_id: AdminDeInstitucion, db: Db, instante: Ahora, pasarela: Pasarela
) -> MiPago:
    return _cancelar(db, _suscripcion_de_institucion(db, institucion_id), pasarela, instante)


# --- Aviso de pago del banco (preparado, apagado por defecto) ----------------------------------


@publico.post(
    "/qrsimple/notifyPaymentQR",
    response_model=RespuestaAvisoQr,
    dependencies=[Depends(limitar_por_ip)],
)
def aviso_de_pago(
    datos: AvisoPagoQr, request: Request, db: Db, instante: Ahora, pasarela: Pasarela
) -> RespuestaAvisoQr:
    """El banco avisa un pago. Nunca activa el plan con el aviso: reconfirma consultando el
    estado del QR (el mismo camino que la consulta de la pantalla). Idempotente por qrId."""
    config: ConfiguracionPagos = request.app.state.config_pagos
    if not config.baneco_aviso_activo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontrado")
    if ip_del_cliente(request) not in config.ips_del_aviso:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No autorizado")
    qr_id = campo_del_banco(datos.payment, "qrId")
    pago = db.scalars(select(PagoQr).where(PagoQr.qr_id == str(qr_id))).first() if qr_id else None
    if pago is not None and pago.estado == "pendiente":
        try:
            pagos.consultar_pago(db, pasarela, pago.id, hoy_local(instante), instante)
        except pagos.BancoNoDisponible as error:
            db.rollback()
            registro_api.warning("Aviso de pago sin reconfirmar: %s", error)
    return RespuestaAvisoQr(responseCode=0, message="")


# --- Administrador de la institución ----------------------------------------------------------


@router.get("/instituciones/{institucion_id}/mi-plan", response_model=MiPlan)
def mi_plan(
    institucion_id: AdminDeInstitucion, db: Db, instante: Ahora, pasarela: Pasarela
) -> MiPlan:
    vigente = service.suscripcion_vigente(db, institucion_id, hoy_local(instante))
    mostrada = vigente or service.ultima_suscripcion(db, institucion_id)
    limites = service.limites(db, vigente)
    return MiPlan(
        institucion=db.get(Institucion, institucion_id).nombre,
        suscripcion=_suscripcion(db, mostrada).model_dump() if mostrada else None,
        limite_docentes=limites.docentes,
        limite_estudiantes=limites.estudiantes,
        docentes=service.miembros_con_rol(db, institucion_id, "docente"),
        estudiantes=service.miembros_con_rol(db, institucion_id, "estudiante"),
        pago_qr=not pagos.es_simulada(pasarela),
    )
