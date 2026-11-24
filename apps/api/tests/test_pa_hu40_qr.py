"""HU-40: pago por QR con el proveedor del banco, contra un servidor FALSO (nunca el banco real)."""

from collections.abc import Iterator
from datetime import date
from decimal import Decimal

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config_pagos import ConfiguracionPagos
from app.core.csrf import CABECERA_CSRF
from app.core.reloj import ahora
from app.main import create_app
from app.modules.plans.baneco import PasarelaBaneco
from app.modules.plans.models import PagoQr, Suscripcion
from tests import escenario, fabricas
from tests.banco_falso import PNG, BancoFalso
from tests.conftest import Reloj, como
from tests.test_baneco import LLAVE, SECRETOS
from tests.test_pa_hu40 import _datos, _institucion, _plan, _registrar, _suscripcion

IP_DEL_BANCO = "203.0.113.50"


def _config(**cambios) -> ConfiguracionPagos:
    valores = {
        **{k: SecretStr(v) for k, v in SECRETOS.items()},
        "baneco_aviso_activo": True,
        "baneco_aviso_ips": IP_DEL_BANCO,
        **cambios,
    }
    return ConfiguracionPagos(pagos_proveedor="baneco", **valores)


@pytest.fixture
def banco(reloj: Reloj) -> BancoFalso:
    return BancoFalso(
        usuario=SECRETOS["baneco_usuario"],
        contrasena=SECRETOS["baneco_contrasena"],
        cuenta=SECRETOS["baneco_cuenta"],
        llave=LLAVE,
        reloj=lambda: reloj.instante.timestamp(),
    )


def _cliente(db: Session, reloj: Reloj, banco: BancoFalso, **config) -> TestClient:
    app = create_app(config_pagos=_config(**config))
    transporte = httpx.Client(transport=httpx.MockTransport(banco.atender))
    app.state.pasarela = PasarelaBaneco(
        app.state.config_pagos, cliente=transporte, reloj=lambda: reloj.instante.timestamp()
    )
    app.dependency_overrides[ahora] = lambda: reloj.instante
    return TestClient(app, base_url="https://testserver", headers={CABECERA_CSRF: "1"})


@pytest.fixture
def cliente_banco(db: Session, reloj: Reloj, banco: BancoFalso) -> Iterator[TestClient]:
    with _cliente(db, reloj, banco) as c:
        yield c


def _registrar_con_precio(cliente: TestClient, db: Session) -> int:
    plan = _plan(db, precio_bs=Decimal("120.00"))
    assert _registrar(cliente, _datos(plan.id)).status_code == 201
    return _institucion(db, "rosa.mendoza")


def _aviso(cliente: TestClient, qr_id: str, ip: str = IP_DEL_BANCO):
    # Sin la cabecera propia: la envía el servidor del banco.
    return cliente.post(
        "/api/qrsimple/notifyPaymentQR",
        json={"payment": {"QRID": qr_id, "amount": 120, "currency": "BOB"}},
        headers={CABECERA_CSRF: "", "x-forwarded-for": ip},
    )


def test_pa_hu40_04_con_el_banco_el_qr_real_se_paga_y_activa_el_plan_una_sola_vez(
    cliente_banco: TestClient, db: Session, banco: BancoFalso, reloj: Reloj
):
    inst = _registrar_con_precio(cliente_banco, db)
    pago = cliente_banco.post("/api/mi-pago/qr").json()
    assert pago["proveedor"] == "baneco"
    qr = pago["qr"]
    assert (qr["estado"], qr["simulado"], qr["imagen_png"]) == ("pendiente", False, PNG)
    # Vence mañana en hora de La Paz, al terminar el día.
    assert qr["vence_en"] == "2026-11-11T23:59:59-04:00"
    [(qr_id, enviado)] = banco.qrs.items()
    assert enviado["transactionId"] == qr["id_transaccion"]
    assert (enviado["amount"], enviado["dueDate"]) == (Decimal("120"), "2026-11-11")
    assert enviado["description"].startswith("SkillTrack-Piano – Plan ")

    assert cliente_banco.post("/api/mi-pago/verificar").json()["estado"] == "pendiente"
    banco.pagar(qr_id)
    # Antes de 5 s no se vuelve a consultar al banco.
    consultas = len(banco.llamadas)
    assert cliente_banco.post("/api/mi-pago/verificar").json()["estado"] == "pendiente"
    assert len(banco.llamadas) == consultas
    reloj.avanzar(seconds=5)
    assert cliente_banco.post("/api/mi-pago/verificar").json()["estado"] == "activa"
    assert cliente_banco.get("/api/auth/me").json()["pago_pendiente"] is False
    s = _suscripcion(db, inst)
    assert (s.inicio, s.fin) == (date(2026, 11, 10), date(2026, 12, 10))

    # Datos mínimos: qrId, monto, moneda, fecha y hora; nada de quien paga.
    fila = db.scalars(select(PagoQr)).one()
    db.refresh(fila)
    assert (fila.qr_id, fila.moneda, fila.fecha_pago, fila.hora_pago) == (
        qr_id,
        "BOB",
        "2026-11-10",
        "10:15:00",
    )
    assert not {c.name for c in PagoQr.__table__.columns} & {
        "sender_name",
        "sender_document_id",
        "sender_account",
        "sender_bank_code",
        "imagen",
    }

    # El aviso duplicado del banco no vuelve a extender el plan.
    reloj.avanzar(seconds=5)
    assert _aviso(cliente_banco, qr_id).json() == {"responseCode": 0, "message": ""}
    assert _aviso(cliente_banco, qr_id).json() == {"responseCode": 0, "message": ""}
    assert _suscripcion(db, inst).fin == date(2026, 12, 10)


def test_pa_hu40_04_un_pago_con_otro_monto_no_activa_el_plan(
    cliente_banco: TestClient, db: Session, banco: BancoFalso, reloj: Reloj
):
    inst = _registrar_con_precio(cliente_banco, db)
    cliente_banco.post("/api/mi-pago/qr")
    [qr_id] = banco.qrs
    banco.pagar(qr_id, monto=Decimal("1.00"))
    assert cliente_banco.post("/api/mi-pago/verificar").json()["estado"] == "pendiente"
    reloj.avanzar(seconds=5)
    banco.qrs[qr_id]["pagos"][0]["amount"] = 120.0
    banco.qrs[qr_id]["pagos"][0]["currency"] = "USD"
    assert cliente_banco.post("/api/mi-pago/verificar").json()["estado"] == "pendiente"
    assert _suscripcion(db, inst).estado == "pendiente"


def test_pa_hu40_04_anulado_o_vencido_se_muestra_y_se_genera_un_qr_nuevo(
    cliente_banco: TestClient, db: Session, banco: BancoFalso, reloj: Reloj
):
    _registrar_con_precio(cliente_banco, db)
    primero = cliente_banco.post("/api/mi-pago/qr").json()["qr"]["id_transaccion"]
    # Anulado en el banco (statusQrCode 9).
    banco.qrs[banco.qr_de_transaccion(primero)]["estado"] = 9
    assert cliente_banco.post("/api/mi-pago/verificar").json()["qr"]["estado"] == "anulado"
    segundo = cliente_banco.post("/api/mi-pago/qr").json()["qr"]
    assert (segundo["estado"], segundo["id_transaccion"] != primero) == ("pendiente", True)

    # Cancelar desde la pantalla llama a cancelQR.
    cancelado = cliente_banco.post("/api/mi-pago/cancelar").json()["qr"]
    assert cancelado["estado"] == "anulado"
    assert "DELETE api/qrsimple/cancelQR" in banco.llamadas

    # Vencido: pasó su día.
    tercero = cliente_banco.post("/api/mi-pago/qr").json()["qr"]["id_transaccion"]
    reloj.avanzar(days=2)
    vencido = cliente_banco.get("/api/mi-pago").json()["qr"]
    assert (vencido["id_transaccion"], vencido["estado"]) == (tercero, "vencido")
    nuevo = cliente_banco.post("/api/mi-pago/qr").json()["qr"]
    assert nuevo["estado"] == "pendiente"
    assert nuevo["vence_en"].startswith("2026-11-13")


def test_pa_hu40_04_si_el_banco_no_responde_se_avisa_y_el_superadmin_puede_activar(
    cliente_banco: TestClient, db: Session, banco: BancoFalso
):
    inst = _registrar_con_precio(cliente_banco, db)
    banco.caido = True
    respuesta = cliente_banco.post("/api/mi-pago/qr")
    assert respuesta.status_code == 503
    assert (
        respuesta.json()["detail"] == "No pudimos generar el QR. Intenta de nuevo en unos minutos."
    )
    assert db.scalars(select(PagoQr)).all() == []

    api = como(cliente_banco, fabricas.usuario(db, "super.a", superadmin=True))
    [cuenta] = api.get("/api/admin/cuentas-pendientes").json()
    assert (
        api.post(f"/api/admin/suscripciones/{cuenta['suscripcion_id']}/activar").status_code == 200
    )
    assert _suscripcion(db, inst).estado == "activa"


def test_pa_hu40_04_el_aviso_nunca_activa_sin_que_el_banco_confirme(
    cliente_banco: TestClient, db: Session, banco: BancoFalso
):
    inst = _registrar_con_precio(cliente_banco, db)
    cliente_banco.post("/api/mi-pago/qr")
    [qr_id] = banco.qrs
    # El QR sigue pendiente en el banco: el aviso responde 0 pero no activa.
    assert _aviso(cliente_banco, qr_id).json()["responseCode"] == 0
    assert _suscripcion(db, inst).estado == "pendiente"
    # Un aviso de un QR que no es nuestro tampoco hace nada.
    assert _aviso(cliente_banco, "QR-AJENO").json()["responseCode"] == 0
    banco.pagar(qr_id)
    assert _aviso(cliente_banco, qr_id).json()["responseCode"] == 0
    assert _suscripcion(db, inst).estado == "activa"


def test_pa_hu40_05_el_aviso_rechaza_ips_no_permitidas_tiene_limite_y_se_puede_apagar(
    db: Session, reloj: Reloj, banco: BancoFalso
):
    with _cliente(db, reloj, banco) as cliente:
        assert _aviso(cliente, "QR1", ip="198.51.100.9").status_code == 403
        # 5 avisos por minuto e IP (la rechazada vino de otra IP).
        for _ in range(5):
            assert _aviso(cliente, "QR1").status_code == 200
        assert _aviso(cliente, "QR1").status_code == 429
    with _cliente(db, reloj, banco, baneco_aviso_ips="") as cliente:
        assert _aviso(cliente, "QR1").status_code == 403
    with _cliente(db, reloj, banco, baneco_aviso_activo=False) as cliente:
        assert _aviso(cliente, "QR1").status_code == 404


def test_pa_hu40_07_las_rutas_de_pago_de_la_institucion_son_solo_de_su_administrador(
    cliente_banco: TestClient, db: Session, banco: BancoFalso, reloj: Reloj
):
    e = escenario.crear(db)
    plan = _plan(db, precio_bs=Decimal("120.00"))
    db.add(
        Suscripcion(
            institucion_id=e.inst_a.id,
            plan_id=plan.id,
            estado="activa",
            inicio=date(2026, 11, 1),
            fin=date(2026, 12, 1),
        )
    )
    db.commit()
    base = f"/api/instituciones/{e.inst_a.id}/pago"
    rutas = [
        ("get", base),
        ("post", f"{base}/qr"),
        ("post", f"{base}/verificar"),
        ("post", f"{base}/cancelar"),
    ]
    for usuario in (e.admin_b, e.docente_a, e.estudiante_a, e.docente_b):
        api = como(cliente_banco, usuario)
        for metodo, ruta in rutas:
            assert getattr(api, metodo)(ruta).status_code == 403, (usuario.username, ruta)

    # El administrador renueva desde "Mi plan": el pago se suma al fin vigente.
    api = como(cliente_banco, e.admin_a)
    assert api.get(f"/api/instituciones/{e.inst_a.id}/mi-plan").json()["pago_qr"] is True
    api.post(f"{base}/qr")
    [qr_id] = banco.qrs
    banco.pagar(qr_id)
    reloj.avanzar(seconds=5)
    renovado = api.post(f"{base}/verificar").json()
    assert (renovado["qr"], renovado["vence_plan"]) == (None, "2026-12-31")


def test_pa_hu40_07_cancelar_el_qr_de_la_cuenta_pendiente_es_solo_de_su_administrador(
    cliente_banco: TestClient, db: Session
):
    e = escenario.crear(db)
    db.add(Suscripcion(institucion_id=e.inst_a.id, plan_id=_plan(db).id, estado="pendiente"))
    db.commit()
    for usuario in (e.docente_a, e.estudiante_a):
        assert como(cliente_banco, usuario).post("/api/mi-pago/cancelar").status_code == 403
    assert como(cliente_banco, e.docente_b).post("/api/mi-pago/cancelar").status_code == 404


def test_pa_hu40_04_tras_reiniciar_la_api_un_qr_sin_imagen_se_anula_y_se_genera_otro(
    cliente_banco: TestClient, db: Session, banco: BancoFalso
):
    from app.modules.plans import router as rutas

    _registrar_con_precio(cliente_banco, db)
    primero = cliente_banco.post("/api/mi-pago/qr").json()["qr"]
    rutas._QR_GENERADOS.clear()  # la imagen solo vivía en memoria
    assert cliente_banco.get("/api/mi-pago").json()["qr"]["imagen_png"] is None
    nuevo = cliente_banco.post("/api/mi-pago/qr").json()["qr"]
    assert nuevo["id_transaccion"] != primero["id_transaccion"]
    assert nuevo["imagen_png"] == PNG
    assert banco.qrs[banco.qr_de_transaccion(primero["id_transaccion"])]["estado"] == 9
