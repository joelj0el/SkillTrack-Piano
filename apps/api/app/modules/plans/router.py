"""Rutas de planes y suscripciones (ADR-004).

Públicas (sin sesión, en RUTAS_PUBLICAS): la lista de planes activos y el envío de una solicitud
de acceso. Todo lo demás exige sesión: la gestión es del superadministrador y "Mi plan" del
administrador de la institución.
"""

from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.contracts_gen.institucion_creada import InstitucionCreada
from app.contracts_gen.institucion_listada import InstitucionListada
from app.contracts_gen.institucion_nueva import InstitucionNueva
from app.contracts_gen.mi_plan import MiPlan
from app.contracts_gen.plan import Plan as PlanDto
from app.contracts_gen.plan_cambio import PlanCambio
from app.contracts_gen.plan_nuevo import PlanNuevo
from app.contracts_gen.solicitud_acceso import SolicitudAcceso as SolicitudDto
from app.contracts_gen.solicitud_acceso_nueva import SolicitudAccesoNueva
from app.contracts_gen.suscripcion import Suscripcion as SuscripcionDto
from app.contracts_gen.suscripcion_cambio import SuscripcionCambio
from app.contracts_gen.suscripcion_nueva import SuscripcionNueva
from app.core.reloj import hoy_local
from app.modules.audit import service as auditoria
from app.modules.identity import service as identidad
from app.modules.identity.deps import Superadmin
from app.modules.institutions import service as instituciones
from app.modules.institutions.deps import AdminDeInstitucion, Ahora, Db
from app.modules.institutions.models import Institucion
from app.modules.plans import service
from app.modules.plans.models import Plan, SolicitudAcceso, Suscripcion

publico = APIRouter(tags=["plans"])
router = APIRouter(tags=["plans"])


def _centavos(valor: float) -> Decimal:
    return Decimal(str(valor)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


NO_ENCONTRADO = HTTPException(status.HTTP_404_NOT_FOUND, "No encontrado")


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


@publico.post("/solicitudes-acceso", status_code=status.HTTP_201_CREATED, response_model=None)
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


# --- Administrador de la institución ----------------------------------------------------------


@router.get("/instituciones/{institucion_id}/mi-plan", response_model=MiPlan)
def mi_plan(institucion_id: AdminDeInstitucion, db: Db, instante: Ahora) -> MiPlan:
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
    )
