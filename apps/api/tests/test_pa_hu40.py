"""HU-40 (ADR-005): registro de compradores, convenios con código, cuenta pendiente de pago."""

from datetime import date
from decimal import Decimal
from itertools import count

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.modules.identity.models import Usuario
from app.modules.plans import pagos
from app.modules.plans.models import ConvenioCodigo, PagoQr, Plan, Suscripcion
from tests import escenario, fabricas
from tests.conftest import Reloj, como, entrar

# Datos SINTÉTICOS: el precio de 120 Bs es de la prueba, no del producto.
PLAN = {
    "nombre": "Docente",
    "descripcion": "Para un docente independiente",
    "beneficios": ["1 docente"],
    "precio_bs": None,
    "periodo": "mensual",
    "limite_docentes": None,
    "limite_estudiantes": None,
    "destacado": False,
    "activo": True,
}


def _plan(db: Session, **cambios) -> Plan:
    plan = Plan(**{**PLAN, **cambios}, orden=0)
    db.add(plan)
    db.commit()
    return plan


def _convenio(db: Session, plan: Plan, **cambios) -> ConvenioCodigo:
    valores = {
        "codigo": "UAB-2026",
        "precio_bs": Decimal("0"),
        "cupos": 2,
        "vence": date(2026, 12, 31),
        **cambios,
    }
    convenio = ConvenioCodigo(plan_id=plan.id, **valores)
    db.add(convenio)
    db.commit()
    return convenio


def _datos(plan_id: int | None, **cambios) -> dict:
    return {
        "tipo": "independiente",
        "nombre": "Rosa Mendoza",
        "correo": "rosa@ejemplo.org",
        "telefono": "+591 70000000",
        "usuario": "rosa.mendoza",
        "clave": "clave-segura-1",
        "institucion": "Clases de piano Rosa",
        "plan_id": plan_id,
        "codigo_convenio": None,
        "acepta_terminos": True,
        **cambios,
    }


_IPS = count(1)


def _registrar(cliente: TestClient, datos: dict):
    """Cada registro desde otra IP de documentación: el límite por IP se prueba aparte."""
    cliente.cookies.clear()
    ip = {"x-forwarded-for": f"192.0.2.{next(_IPS) % 250 + 1}"}
    return cliente.post("/api/registro", json=datos, headers=ip)


def _institucion(db: Session, usuario: str) -> int:
    u = db.scalar(select(Usuario).where(Usuario.username == usuario))
    return db.execute(
        text("SELECT institucion_id FROM app.membresia WHERE usuario_id = :u LIMIT 1"),
        {"u": u.id},
    ).scalar_one()


def _suscripcion(db: Session, institucion_id: int) -> Suscripcion:
    db.expire_all()
    return db.scalars(select(Suscripcion).where(Suscripcion.institucion_id == institucion_id)).one()


# --- Registro ----------------------------------------------------------------------------------


def test_pa_hu40_01_el_registro_crea_institucion_suscripcion_pendiente_y_administrador(
    cliente: TestClient, db: Session
):
    plan = _plan(db)
    respuesta = _registrar(cliente, _datos(plan.id))
    assert respuesta.status_code == 201, respuesta.text
    yo = respuesta.json()
    # Abre la sesión: la cookie queda en el cliente y /me responde.
    assert cliente.get("/api/auth/me").json()["usuario"] == "rosa.mendoza"
    assert yo["pago_pendiente"] is True
    assert yo["clave_temporal"] is False
    assert sorted(m["rol"] for m in yo["membresias"]) == ["admin_inst", "docente"]
    inst = _institucion(db, "rosa.mendoza")
    s = _suscripcion(db, inst)
    assert (s.estado, s.plan_id, s.inicio, s.fin) == ("pendiente", plan.id, None, None)
    usuario = db.scalar(select(Usuario).where(Usuario.username == "rosa.mendoza"))
    assert usuario.terminos_aceptados_en is not None
    assert usuario.es_menor is False

    # Una institución: el usuario solo la administra.
    otra = _registrar(
        cliente,
        _datos(plan.id, tipo="institucion", usuario="escuela.admin", correo="e@ejemplo.org"),
    )
    assert [m["rol"] for m in otra.json()["membresias"]] == ["admin_inst"]

    # Usuario y correo únicos (el correo sin distinguir mayúsculas).
    repetido = _registrar(cliente, _datos(plan.id, correo="otra@ejemplo.org"))
    assert repetido.status_code == 409
    assert "usuario" in repetido.json()["detail"]
    correo = _registrar(cliente, _datos(plan.id, usuario="rosa.dos", correo="ROSA@ejemplo.org"))
    assert correo.status_code == 409
    assert "correo" in correo.json()["detail"]

    # Contraseña con las reglas vigentes y aceptación de términos obligatoria.
    assert _registrar(cliente, _datos(plan.id, usuario="x.y", clave="1234567")).status_code == 422
    sin_terminos = _datos(plan.id, usuario="x.z", acepta_terminos=False)
    assert _registrar(cliente, sin_terminos).status_code == 422
    # Sin plan ni código, o con un plan inactivo: mensaje claro.
    sin_plan = _registrar(cliente, _datos(None, usuario="x.w", correo="w@ejemplo.org"))
    assert sin_plan.json()["detail"] == "Elige un plan o escribe un código de convenio."
    inactivo = _plan(db, nombre="Antiguo", activo=False)
    con_inactivo = _registrar(cliente, _datos(inactivo.id, usuario="x.v", correo="v@e.org"))
    assert con_inactivo.status_code == 422
    assert "no está disponible" in con_inactivo.json()["detail"]


def test_pa_hu40_02_un_codigo_de_convenio_valido_asigna_el_convenio_y_con_precio_0_activa(
    cliente: TestClient, db: Session
):
    plan = _plan(db)
    gratis = _convenio(db, plan, codigo="UAB-2026", precio_bs=Decimal("0"), cupos=1)
    _convenio(db, plan, codigo="ESPECIAL-50", precio_bs=Decimal("50"))
    _convenio(db, plan, codigo="VIEJO-2025", vence=date(2025, 12, 31))

    # El código se acepta como lo escriba la persona; el plan sale del convenio.
    activa = _registrar(cliente, _datos(None, codigo_convenio="uab-2026"))
    assert activa.status_code == 201, activa.text
    assert activa.json()["pago_pendiente"] is False
    s = _suscripcion(db, _institucion(db, "rosa.mendoza"))
    assert (s.estado, s.convenio_codigo_id, s.inicio, s.fin) == (
        "activa",
        gratis.id,
        date(2026, 11, 10),
        date(2026, 12, 10),
    )

    con_precio = _registrar(
        cliente,
        _datos(None, usuario="ana.p", correo="ana@e.org", codigo_convenio="ESPECIAL-50"),
    )
    assert con_precio.json()["pago_pendiente"] is True
    assert cliente.get("/api/mi-pago").json()["monto_bs"] == 50
    assert cliente.get("/api/mi-pago").json()["codigo_convenio"] == "ESPECIAL-50"

    def rechazo(codigo: str, usuario: str) -> str:
        r = _registrar(
            cliente,
            _datos(None, usuario=usuario, correo=f"{usuario}@e.org", codigo_convenio=codigo),
        )
        assert r.status_code == 422, r.text
        return r.json()["detail"]

    assert rechazo("NO-EXISTE", "u.a").startswith("El código de convenio no existe")
    assert rechazo("VIEJO-2025", "u.b") == "El código de convenio venció el 31/12/2025."
    assert rechazo("UAB-2026", "u.c") == "El código de convenio ya no tiene cupos disponibles."
    # Ninguno de los rechazados dejó usuario ni institución.
    assert db.scalar(select(Usuario).where(Usuario.username.in_(["u.a", "u.b", "u.c"]))) is None


# --- Cuenta pendiente de pago ------------------------------------------------------------------


def test_pa_hu40_03_la_cuenta_pendiente_entra_pero_solo_puede_pagar_o_salir(
    cliente: TestClient, db: Session
):
    plan = _plan(db)
    _registrar(cliente, _datos(plan.id))
    inst = _institucion(db, "rosa.mendoza")
    for ruta in (
        f"/api/instituciones/{inst}/usuarios",
        f"/api/instituciones/{inst}/mi-plan",
        "/api/mis-estudiantes",
        "/api/catalogo/ejercicios",
    ):
        r = cliente.get(ruta)
        assert r.status_code == 403, ruta
        assert r.json()["detail"].startswith("Tu cuenta está pendiente de pago")
    assert cliente.get("/api/mi-pago").status_code == 200

    # Puede volver a entrar: sigue pendiente.
    cliente.post("/api/auth/logout")
    cliente.cookies.clear()
    yo = entrar(cliente, "rosa.mendoza", "clave-segura-1").get("/api/auth/me").json()
    assert yo["pago_pendiente"] is True
    assert cliente.post("/api/auth/logout").status_code == 204


def test_pa_hu40_04_confirmado_el_pago_por_el_adaptador_el_plan_se_activa_una_vez(
    cliente: TestClient, db: Session, reloj: Reloj
):
    plan = _plan(db, precio_bs=Decimal("120.00"))
    pasarela = pagos.PasarelaSimulada()
    cliente.app.dependency_overrides[pagos.pasarela_vigente] = lambda: pasarela
    _registrar(cliente, _datos(plan.id))
    inst = _institucion(db, "rosa.mendoza")

    pago = cliente.get("/api/mi-pago").json()
    assert (pago["plan"], pago["monto_bs"], pago["estado"], pago["qr"]) == (
        "Docente",
        120,
        "pendiente",
        None,
    )
    qr = cliente.post("/api/mi-pago/qr").json()["qr"]
    assert qr["simulado"] is True
    assert qr["imagen_png"] is None
    # Un segundo pedido reutiliza el QR pendiente.
    assert cliente.post("/api/mi-pago/qr").json()["qr"]["id_transaccion"] == qr["id_transaccion"]
    assert cliente.post("/api/mi-pago/verificar").json()["estado"] == "pendiente"

    pasarela.marcar(qr["id_transaccion"], "pagado")
    # Como mucho una consulta al banco cada 5 s por pago.
    assert cliente.post("/api/mi-pago/verificar").json()["estado"] == "pendiente"
    reloj.avanzar(seconds=5)
    assert cliente.post("/api/mi-pago/verificar").json()["estado"] == "activa"
    assert cliente.get("/api/auth/me").json()["pago_pendiente"] is False
    assert cliente.get(f"/api/instituciones/{inst}/usuarios").status_code == 200
    s = _suscripcion(db, inst)
    assert (s.inicio, s.fin) == (date(2026, 11, 10), date(2026, 12, 10))

    # Ya no hay pago pendiente; una segunda confirmación no vuelve a extender.
    assert cliente.get("/api/mi-pago").status_code == 404
    [fila] = db.scalars(select(PagoQr)).all()
    reloj.avanzar(days=3)
    assert pagos.confirmar_pago(db, fila.id, date(2026, 11, 13), reloj.instante) is False
    assert _suscripcion(db, inst).fin == date(2026, 12, 10)

    # Un adaptador nuevo (la API reinició) no repite el id de un pago ya guardado.
    assert pagos.nuevo_id_transaccion() != fila.id_transaccion


def test_pa_hu40_04_el_superadministrador_activa_desde_solicitudes_una_sola_vez(
    cliente: TestClient, db: Session
):
    plan = _plan(db, precio_bs=Decimal("120.00"))
    _registrar(cliente, _datos(plan.id))
    cliente.post("/api/mi-pago/qr")
    inst = _institucion(db, "rosa.mendoza")

    api = como(cliente, fabricas.usuario(db, "super.a", superadmin=True))
    [cuenta] = api.get("/api/admin/cuentas-pendientes").json()
    assert cuenta["institucion"] == "Clases de piano Rosa"
    assert (cuenta["correo"], cuenta["telefono"]) == ("rosa@ejemplo.org", "+591 70000000")
    assert (cuenta["monto_bs"], cuenta["qr_generado"]) == (120, True)

    ruta = f"/api/admin/suscripciones/{cuenta['suscripcion_id']}/activar"
    assert api.post(ruta).json()["estado"] == "activa"
    assert api.post(ruta).json()["fin"] == "2026-12-10"
    assert api.get("/api/admin/cuentas-pendientes").json() == []
    # El QR pendiente quedó pagado: una confirmación posterior del banco no extiende el plan.
    [fila] = db.scalars(select(PagoQr)).all()
    db.refresh(fila)
    assert fila.estado == "pagado"
    assert pagos.confirmar_pago(db, fila.id, date(2026, 11, 20), fila.creado_en) is False
    assert _suscripcion(db, inst).fin == date(2026, 12, 10)

    cliente.cookies.clear()
    yo = entrar(cliente, "rosa.mendoza", "clave-segura-1").get("/api/auth/me").json()
    assert yo["pago_pendiente"] is False


# --- Límite por IP -----------------------------------------------------------------------------


def test_pa_hu40_05_el_registro_y_las_solicitudes_tienen_limite_por_minuto_e_ip(
    cliente: TestClient, db: Session, reloj: Reloj
):
    plan = _plan(db)
    solicitud = {
        "nombre": "Rosa",
        "institucion": "Escuela",
        "correo": "rosa@ejemplo.org",
        "telefono": None,
        "plan_id": None,
        "mensaje": None,
    }
    cliente.cookies.clear()
    ip = {"x-forwarded-for": "203.0.113.7"}
    for _ in range(5):
        assert (
            cliente.post("/api/solicitudes-acceso", json=solicitud, headers=ip).status_code == 201
        )
    bloqueada = cliente.post("/api/solicitudes-acceso", json=solicitud, headers=ip)
    assert bloqueada.status_code == 429
    assert "Espera un minuto" in bloqueada.json()["detail"]
    # Otra IP (la última entrada, la que agrega el proxy) no está bloqueada.
    otra = {"x-forwarded-for": "198.51.100.1, 203.0.113.8"}
    assert cliente.post("/api/solicitudes-acceso", json=solicitud, headers=otra).status_code == 201

    # El registro cuenta aparte; también los intentos rechazados.
    for i in range(5):
        datos = _datos(plan.id, usuario=f"r.{i}", correo=f"r{i}@e.org", clave="corta")
        assert cliente.post("/api/registro", json=datos, headers=ip).status_code == 422
    assert cliente.post("/api/registro", json=_datos(plan.id), headers=ip).status_code == 429

    reloj.avanzar(minutes=1)
    assert cliente.post("/api/registro", json=_datos(plan.id), headers=ip).status_code == 201


# --- Convenios del superadministrador ------------------------------------------------------------


def test_pa_hu40_06_el_superadministrador_crea_convenios_y_ve_cuantos_se_usaron(
    cliente: TestClient, db: Session
):
    plan = _plan(db)
    api = como(cliente, fabricas.usuario(db, "super.a", superadmin=True))
    convenio = {
        "codigo": "UAB-2026",
        "plan_id": plan.id,
        "precio_bs": 0,
        "cupos": 3,
        "vence": "2026-12-31",
    }
    creado = api.post("/api/admin/convenios", json=convenio)
    assert creado.status_code == 201, creado.text
    assert (creado.json()["plan"], creado.json()["usados"]) == ("Docente", 0)
    assert api.post("/api/admin/convenios", json=convenio).status_code == 409
    sin_plan = api.post("/api/admin/convenios", json={**convenio, "codigo": "X-1", "plan_id": 999})
    assert sin_plan.status_code == 422

    _registrar(cliente, _datos(None, codigo_convenio="UAB-2026"))
    api = como(cliente, db.scalar(select(Usuario).where(Usuario.username == "super.a")))
    assert [c["usados"] for c in api.get("/api/admin/convenios").json()] == [1]


# --- Autorización (403) ------------------------------------------------------------------------

RUTAS_SUPERADMIN = [
    ("get", "/api/admin/convenios", None),
    (
        "post",
        "/api/admin/convenios",
        {"codigo": "ABCD", "plan_id": 1, "precio_bs": 0, "cupos": 1, "vence": "2026-12-31"},
    ),
    ("get", "/api/admin/cuentas-pendientes", None),
    ("post", "/api/admin/suscripciones/1/activar", None),
]


@pytest.mark.parametrize(("metodo", "ruta", "cuerpo"), RUTAS_SUPERADMIN)
def test_pa_hu40_07_solo_el_superadministrador_gestiona_convenios_y_cuentas_pendientes(
    cliente: TestClient, db: Session, metodo: str, ruta: str, cuerpo: dict | None
):
    e = escenario.crear(db)
    investigador = fabricas.usuario(db, "investigador.a", rol="investigador", inst=e.inst_a)
    for usuario in (e.admin_a, e.docente_a, e.estudiante_a, investigador, e.docente_b):
        api = como(cliente, usuario)
        respuesta = getattr(api, metodo)(ruta, **({"json": cuerpo} if cuerpo else {}))
        assert respuesta.status_code == 403, (usuario.username, respuesta.text)


def test_pa_hu40_07_el_pago_solo_lo_ve_el_administrador_de_la_cuenta_pendiente(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    plan = _plan(db)
    db.add(Suscripcion(institucion_id=e.inst_a.id, plan_id=plan.id, estado="pendiente"))
    db.commit()
    # Miembros de la institución pendiente que no la administran: 403.
    for usuario in (e.docente_a, e.estudiante_a):
        assert como(cliente, usuario).get("/api/mi-pago").status_code == 403, usuario.username
        assert como(cliente, usuario).post("/api/mi-pago/qr").status_code == 403
        assert como(cliente, usuario).post("/api/mi-pago/verificar").status_code == 403
    assert como(cliente, e.admin_a).get("/api/mi-pago").status_code == 200
    # De otra institución (sin pago pendiente): nada que pagar.
    for usuario in (e.admin_b, e.docente_b):
        assert como(cliente, usuario).get("/api/mi-pago").status_code == 404, usuario.username


# --- Datos mínimos -----------------------------------------------------------------------------


def test_pa_hu40_08_sin_datos_de_tarjeta_y_contacto_solo_para_el_usuario_y_el_superadmin(
    cliente: TestClient, db: Session
):
    plan = _plan(db)
    _registrar(cliente, _datos(None, codigo_convenio="UAB-2026"))  # sin convenio: rechazado
    _convenio(db, plan)
    yo = _registrar(cliente, _datos(None, codigo_convenio="UAB-2026")).json()
    # El propio usuario ve su contacto.
    assert (yo["correo"], yo["telefono"]) == ("rosa@ejemplo.org", "+591 70000000")
    inst = _institucion(db, "rosa.mendoza")
    # La institución crea un docente; él no ve el contacto del administrador en ninguna lista.
    creado = cliente.post(
        f"/api/instituciones/{inst}/usuarios",
        json={"usuario": "doc.uno", "nombre_visible": "Doc", "es_menor": False, "rol": "docente"},
    )
    assert creado.status_code == 201, creado.text
    lista = cliente.get(f"/api/instituciones/{inst}/usuarios").json()
    assert all(set(u) == {"id", "usuario", "nombre_visible", "es_menor", "roles"} for u in lista)
    docente = db.scalar(select(Usuario).where(Usuario.username == "doc.uno"))
    assert (docente.email, docente.telefono) == (None, None)

    # Ninguna columna de la base guarda datos de tarjeta.
    columnas = db.execute(
        text(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = 'app'"
            " AND (column_name ILIKE '%tarjeta%' OR column_name ILIKE '%card%'"
            " OR column_name ILIKE '%cvv%')"
        )
    ).all()
    assert columnas == []
