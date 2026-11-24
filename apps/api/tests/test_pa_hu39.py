"""HU-39 (ADR-004): planes, suscripciones, límites, solicitudes de acceso y pago por QR."""

from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.plans.models import PagoQr, Plan, Suscripcion
from app.modules.plans.pagos import (
    PasarelaNoDisponible,
    PasarelaSimulada,
    SinPrecio,
    confirmar_pago,
    consultar_pago,
    iniciar_pago,
)
from tests import escenario, fabricas
from tests.conftest import como

PLAN = {
    "nombre": "Institución",
    "descripcion": "Para escuelas y conservatorios",
    "beneficios": ["Varios docentes", "Vista Mi grupo"],
    "precio_bs": None,
    "periodo": "mensual",
    "limite_docentes": None,
    "limite_estudiantes": None,
    "destacado": True,
    "activo": True,
}
INSTANTE = datetime(2026, 11, 10, 12, 0, tzinfo=UTC)


def _plan(db: Session, **cambios) -> Plan:
    valores = {**PLAN, **cambios}
    plan = Plan(**valores, orden=0)
    db.add(plan)
    db.commit()
    return plan


def _suscribir(db: Session, institucion_id: int, plan: Plan, **cambios) -> Suscripcion:
    s = Suscripcion(
        institucion_id=institucion_id,
        plan_id=plan.id,
        estado=cambios.pop("estado", "activa"),
        inicio=date(2026, 11, 1),
        fin=cambios.pop("fin", date(2026, 12, 1)),
        convenio=cambios.pop("convenio", False),
        **cambios,
    )
    db.add(s)
    db.commit()
    return s


def _superadmin(db: Session):
    return fabricas.usuario(db, "super.a", superadmin=True)


# --- Rutas públicas ----------------------------------------------------------------------------


def test_pa_hu39_01_la_ruta_publica_lista_solo_los_planes_activos_sin_sesion(
    cliente: TestClient, db: Session
):
    _plan(db)
    _plan(db, nombre="Antiguo", activo=False, destacado=False)
    cliente.cookies.clear()
    respuesta = cliente.get("/api/planes")
    assert respuesta.status_code == 200
    planes = respuesta.json()
    assert [p["nombre"] for p in planes] == ["Institución"]
    # Sin precio ni límites definidos: vacíos (la interfaz muestra "—").
    assert planes[0]["precio_bs"] is None
    assert planes[0]["limite_estudiantes"] is None
    # Solo lectura: la ruta pública no acepta escrituras.
    assert cliente.post("/api/planes", json=PLAN).status_code == 405


def test_pa_hu39_02_la_solicitud_de_acceso_se_envia_sin_sesion_y_la_ve_el_superadministrador(
    cliente: TestClient, db: Session
):
    plan = _plan(db)
    cliente.cookies.clear()
    datos = {
        "nombre": "Rosa Mendoza",
        "institucion": "Escuela de ejemplo",
        "correo": "rosa@ejemplo.org",
        "telefono": None,
        "plan_id": plan.id,
        "mensaje": "Queremos probarlo con dos cursos.",
    }
    assert cliente.post("/api/solicitudes-acceso", json=datos).status_code == 201
    assert cliente.post("/api/solicitudes-acceso", json={**datos, "correo": "x"}).status_code == 422

    lista = como(cliente, _superadmin(db)).get("/api/admin/solicitudes-acceso").json()
    assert [(s["nombre"], s["plan"], s["atendida"]) for s in lista] == [
        ("Rosa Mendoza", "Institución", False)
    ]
    atendida = cliente.post(f"/api/admin/solicitudes-acceso/{lista[0]['id']}/atender")
    assert atendida.json()["atendida"] is True


# --- Superadministrador ------------------------------------------------------------------------


def test_pa_hu39_03_el_superadministrador_crea_edita_y_desactiva_planes(
    cliente: TestClient, db: Session
):
    api = como(cliente, _superadmin(db))
    creado = api.post("/api/admin/planes", json=PLAN)
    assert creado.status_code == 201, creado.text
    plan_id = creado.json()["id"]
    assert api.post("/api/admin/planes", json=PLAN).status_code == 409

    cambiado = api.patch(
        f"/api/admin/planes/{plan_id}",
        json={"precio_bs": 150.5, "limite_estudiantes": 40},
    )
    assert cambiado.json()["precio_bs"] == 150.5
    assert cambiado.json()["limite_estudiantes"] == 40

    api.patch(f"/api/admin/planes/{plan_id}", json={"activo": False})
    assert api.get("/api/planes").json() == []
    assert [p["activo"] for p in api.get("/api/admin/planes").json()] == [False]


def test_pa_hu39_04_un_docente_independiente_es_una_institucion_de_un_solo_docente_con_convenio(
    cliente: TestClient, db: Session
):
    plan = _plan(db, nombre="Docente", limite_docentes=1)
    api = como(cliente, _superadmin(db))
    creada = api.post(
        "/api/admin/instituciones",
        json={
            "nombre": "Prof. Ejemplo",
            "independiente": True,
            "admin_usuario": "prof.ejemplo",
            "admin_nombre": "Prof. Ejemplo",
            "admin_email": None,
        },
    )
    assert creada.status_code == 201, creada.text
    inst = creada.json()["id"]
    suscripcion = api.post(
        "/api/admin/suscripciones",
        json={
            "institucion_id": inst,
            "plan_id": plan.id,
            "estado": "activa",
            "inicio": "2026-11-01",
            "fin": "2026-12-01",
            "convenio": True,
            "condiciones": "Precio según el convenio con el conservatorio",
            "limite_docentes": 1,
            "limite_estudiantes": 2,
        },
    )
    assert suscripcion.status_code == 201, suscripcion.text
    assert suscripcion.json()["convenio"] is True
    cambiada = api.patch(
        f"/api/admin/suscripciones/{suscripcion.json()['id']}",
        json={"limite_estudiantes": 3},
    )
    assert cambiada.json()["limite_estudiantes"] == 3

    usuario = api.get(f"/api/instituciones/{inst}/usuarios").json()
    assert usuario[0]["roles"] == ["admin_inst", "docente"]


# --- Límites y Mi plan -------------------------------------------------------------------------


def _nuevo(n: int, rol: str = "estudiante") -> dict:
    return {
        "usuario": f"nuevo.{rol}.{n}",
        "nombre_visible": f"Nuevo {n}",
        "email": None,
        "es_menor": False,
        "rol": rol,
    }


def test_pa_hu39_05_los_limites_se_aplican_al_crear_usuarios_con_un_mensaje_claro(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)  # inst_a ya tiene 2 estudiantes y 2 docentes
    plan = _plan(db, limite_estudiantes=3, limite_docentes=2)
    _suscribir(db, e.inst_a.id, plan)
    api = como(cliente, e.admin_a)
    ruta = f"/api/instituciones/{e.inst_a.id}/usuarios"

    assert api.post(ruta, json=_nuevo(1)).status_code == 201
    rechazo = api.post(ruta, json=_nuevo(2))
    assert rechazo.status_code == 409
    assert rechazo.json()["detail"] == (
        "Llegaste al límite de estudiantes del plan Institución: permite 3 y ya hay 3. "
        "Para agregar más, pide ampliar el plan al superadministrador."
    )
    assert api.post(ruta, json=_nuevo(3, "docente")).status_code == 409
    # Otros roles no tienen límite.
    assert api.post(ruta, json=_nuevo(4, "investigador")).status_code == 201


def test_pa_hu39_06_sin_suscripcion_activa_o_con_limite_sin_definir_no_hay_limite(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    plan = _plan(db, limite_estudiantes=1)
    _suscribir(db, e.inst_a.id, plan, estado="vencida")
    api = como(cliente, e.admin_a)
    ruta = f"/api/instituciones/{e.inst_a.id}/usuarios"
    assert api.post(ruta, json=_nuevo(1)).status_code == 201

    # Convenio con límite de estudiantes sin definir: reemplaza el del plan.
    _suscribir(db, e.inst_a.id, plan, convenio=True, limite_estudiantes=None)
    assert api.post(ruta, json=_nuevo(2)).status_code == 201


def test_pa_hu39_07_mi_plan_muestra_el_plan_los_limites_usados_y_el_vencimiento(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    plan = _plan(db, limite_estudiantes=30)
    _suscribir(db, e.inst_a.id, plan)
    datos = como(cliente, e.admin_a).get(f"/api/instituciones/{e.inst_a.id}/mi-plan").json()
    assert datos["institucion"] == "Instituto A"
    assert datos["suscripcion"]["plan"] == "Institución"
    assert datos["suscripcion"]["fin"] == "2026-12-01"
    assert (datos["estudiantes"], datos["limite_estudiantes"]) == (2, 30)
    assert (datos["docentes"], datos["limite_docentes"]) == (2, None)

    sin_plan = como(cliente, e.admin_b).get(f"/api/instituciones/{e.inst_b.id}/mi-plan").json()
    assert sin_plan["suscripcion"] is None


# --- Autorización (403) ------------------------------------------------------------------------

RUTAS_SUPERADMIN = [
    ("get", "/api/admin/planes", None),
    ("post", "/api/admin/planes", PLAN),
    ("patch", "/api/admin/planes/1", {"activo": False}),
    ("get", "/api/admin/instituciones", None),
    (
        "post",
        "/api/admin/instituciones",
        {
            "nombre": "X",
            "independiente": False,
            "admin_usuario": "x.admin",
            "admin_nombre": "X",
            "admin_email": None,
        },
    ),
    ("get", "/api/admin/suscripciones", None),
    (
        "post",
        "/api/admin/suscripciones",
        {
            "institucion_id": 1,
            "plan_id": 1,
            "estado": "activa",
            "inicio": None,
            "fin": None,
            "convenio": False,
            "condiciones": None,
            "limite_docentes": None,
            "limite_estudiantes": None,
        },
    ),
    ("patch", "/api/admin/suscripciones/1", {"estado": "cancelada"}),
    ("get", "/api/admin/solicitudes-acceso", None),
    ("post", "/api/admin/solicitudes-acceso/1/atender", None),
]


@pytest.mark.parametrize(("metodo", "ruta", "cuerpo"), RUTAS_SUPERADMIN)
def test_pa_hu39_08_solo_el_superadministrador_gestiona_planes_convenios_y_solicitudes(
    cliente: TestClient, db: Session, metodo: str, ruta: str, cuerpo: dict | None
):
    e = escenario.crear(db)
    investigador = fabricas.usuario(db, "investigador.a", rol="investigador", inst=e.inst_a)
    for usuario in (e.admin_a, e.docente_a, e.estudiante_a, investigador, e.docente_b):
        api = como(cliente, usuario)
        respuesta = getattr(api, metodo)(ruta, **({"json": cuerpo} if cuerpo else {}))
        assert respuesta.status_code == 403, (usuario.username, respuesta.text)


def test_pa_hu39_09_mi_plan_solo_lo_ve_el_administrador_de_esa_institucion(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    ruta = f"/api/instituciones/{e.inst_a.id}/mi-plan"
    assert como(cliente, e.admin_a).get(ruta).status_code == 200
    for ajeno in (e.admin_b, e.docente_a, e.estudiante_a, e.docente_b):
        assert como(cliente, ajeno).get(ruta).status_code == 403, ajeno.username


# --- Pago por QR (adaptador simulado: nunca llama al banco) -------------------------------------


def test_pa_hu39_10_un_pago_confirmado_dos_veces_activa_la_suscripcion_una_sola_vez(
    db: Session,
):
    e = escenario.crear(db)
    plan = _plan(db, precio_bs=Decimal("120.00"), periodo="mensual")
    s = _suscribir(db, e.inst_a.id, plan, estado="pendiente", fin=None)
    pasarela = PasarelaSimulada()
    pago, qr = iniciar_pago(db, pasarela, s, INSTANTE)
    db.commit()
    assert pago.monto_bs == Decimal("120.00")
    assert consultar_pago(db, pasarela, pago.id, date(2026, 11, 10), INSTANTE) == "pendiente"

    pasarela.marcar(qr.id_transaccion, "pagado")
    assert consultar_pago(db, pasarela, pago.id, date(2026, 11, 10), INSTANTE) == "pagado"
    db.refresh(s)
    assert (s.estado, s.inicio, s.fin) == (
        "activa",
        date(2026, 11, 10),
        date(2026, 12, 10),
    )

    # Segunda confirmación (consulta repetida o aviso duplicado): no vuelve a extender.
    assert confirmar_pago(db, pago.id, date(2026, 11, 20), INSTANTE) is False
    assert consultar_pago(db, pasarela, pago.id, date(2026, 11, 20), INSTANTE) == "pagado"
    db.refresh(s)
    assert s.fin == date(2026, 12, 10)
    assert len(db.scalars(select(PagoQr)).all()) == 1


def test_pa_hu39_11_sin_adaptador_del_banco_o_sin_precio_no_se_genera_el_qr(
    db: Session,
):
    e = escenario.crear(db)
    s = _suscribir(db, e.inst_a.id, _plan(db), estado="pendiente")
    with pytest.raises(PasarelaNoDisponible):
        iniciar_pago(db, None, s, INSTANTE)
    with pytest.raises(SinPrecio):
        iniciar_pago(db, PasarelaSimulada(), s, INSTANTE)
