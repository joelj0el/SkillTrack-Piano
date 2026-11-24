"""Adaptador de pago QR del banco, contra un servidor FALSO: nunca se llama al banco real."""

import logging
from datetime import date
from decimal import Decimal

import httpx
import pytest
from pydantic import SecretStr

from app.core.config_pagos import ConfiguracionInvalida, ConfiguracionPagos, validar
from app.modules.plans.baneco import PasarelaBaneco
from app.modules.plans.cifrado_baneco import cifrar, descifrar
from app.modules.plans.pagos import BancoNoDisponible
from tests.banco_falso import PNG, BancoFalso

# Datos SINTÉTICOS (la llave del vector es la del ejemplo público del manual del banco).
LLAVE = "0123456789ABCDEF0123456789ABCDEF"
SECRETOS = {
    "baneco_api_url": "https://banco-falso.test/ApiGateway/",
    "baneco_usuario": "usuario-prueba",
    "baneco_contrasena": "contrasena-prueba",
    "baneco_cuenta": "1234567890",
    "baneco_llave_aes": LLAVE,
}


class Reloj:
    def __init__(self) -> None:
        self.ahora = 1_000_000.0

    def __call__(self) -> float:
        return self.ahora


def configuracion(**cambios) -> ConfiguracionPagos:
    valores = {**SECRETOS, **cambios}
    return ConfiguracionPagos(
        pagos_proveedor="baneco", **{k: SecretStr(v) for k, v in valores.items()}
    )


def armar(reloj: Reloj | None = None) -> tuple[PasarelaBaneco, BancoFalso, Reloj]:
    reloj = reloj or Reloj()
    banco = BancoFalso(
        usuario=SECRETOS["baneco_usuario"],
        contrasena=SECRETOS["baneco_contrasena"],
        cuenta=SECRETOS["baneco_cuenta"],
        llave=LLAVE,
        reloj=reloj,
    )
    cliente = httpx.Client(transport=httpx.MockTransport(banco.atender))
    return PasarelaBaneco(configuracion(), cliente=cliente, reloj=reloj), banco, reloj


def generar(pasarela: PasarelaBaneco, monto: str = "50.00"):
    return pasarela.generar_qr(
        id_transaccion="ST-PRUEBA1",
        monto_bs=Decimal(monto),
        descripcion="SkillTrack-Piano – Plan Docente",
        vence=date(2026, 11, 11),
    )


# --- Cifrado y configuración ---------------------------------------------------------------------


def test_pu_baneco_01_descifra_el_vector_publico_y_cifra_ida_y_vuelta():
    vector = "KJAzqjmwjxIOqVo5J3IH0/7fGmNdzuyszrlqexVSeos="
    assert descifrar(vector, "40A318B299F245C2B697176723088629") == "1234"
    cifrado = cifrar("cuenta 123 ñ", LLAVE)
    assert descifrar(cifrado, LLAVE) == "cuenta 123 ñ"
    # IV aleatorio: el mismo texto no se cifra igual dos veces.
    assert cifrar("1234", LLAVE) != cifrar("1234", LLAVE)
    with pytest.raises(ValueError):
        cifrar("1234", "corta")


def test_pu_baneco_02_con_baneco_falta_una_variable_o_la_llave_no_mide_32_y_no_arranca():
    validar(ConfiguracionPagos(pagos_proveedor="simulado"))
    with pytest.raises(ConfiguracionInvalida) as error:
        validar(configuracion(baneco_cuenta="", baneco_usuario=" "))
    assert str(error.value).endswith("BANECO_USUARIO, BANECO_CUENTA.")
    with pytest.raises(ConfiguracionInvalida) as error:
        validar(configuracion(baneco_llave_aes="1" * 31))
    assert str(error.value) == "BANECO_LLAVE_AES debe tener 32 caracteres."
    # El mensaje nunca trae valores.
    assert "1111" not in str(error.value)
    assert "**" in repr(configuracion())
    assert LLAVE not in repr(configuracion())


# --- Token ---------------------------------------------------------------------------------------


def test_pu_baneco_03_el_token_se_reutiliza_y_se_renueva_5_minutos_antes_de_vencer():
    pasarela, banco, reloj = armar()
    generar(pasarela)
    generar(pasarela)
    assert banco.autenticaciones == 1
    reloj.ahora += 24 * 60  # faltan 6 minutos: sigue vigente
    generar(pasarela)
    assert banco.autenticaciones == 1
    reloj.ahora += 2 * 60  # faltan 4 minutos: se renueva antes de usarlo
    generar(pasarela)
    assert banco.autenticaciones == 2


def test_pu_baneco_04_ante_un_401_renueva_el_token_y_reintenta_una_sola_vez():
    pasarela, banco, _ = armar()
    generar(pasarela)
    banco.rechazar_siguientes = 1
    assert generar(pasarela).qr_id
    assert banco.autenticaciones == 2
    banco.rechazar_siguientes = 2
    with pytest.raises(BancoNoDisponible) as error:
        generar(pasarela)
    assert str(error.value) == "generar QR: HTTP 401"


# --- Generar, estado, anular y conciliación ------------------------------------------------------


def test_pu_baneco_05_genera_el_qr_con_la_cuenta_cifrada_y_el_monto_de_2_decimales():
    pasarela, banco, _ = armar()
    qr = generar(pasarela, "75.5")
    assert (qr.id_transaccion, qr.imagen, qr.vence) == ("ST-PRUEBA1", PNG, date(2026, 11, 11))
    enviado = banco.qrs[qr.qr_id]
    assert (enviado["amount"], enviado["dueDate"]) == (Decimal("75.5"), "2026-11-11")
    assert enviado["description"] == "SkillTrack-Piano – Plan Docente"


def test_pu_baneco_06_estado_pendiente_pagado_y_anulado_leidos_sin_distinguir_mayusculas():
    pasarela, banco, _ = armar()
    qr = generar(pasarela)
    assert pasarela.consultar(qr.qr_id).estado == "pendiente"
    banco.pagar(qr.qr_id)
    estado = pasarela.consultar(qr.qr_id)
    assert estado.estado == "pagado"
    [pago] = estado.pagos
    assert (pago.qr_id, pago.monto, pago.moneda) == (qr.qr_id, Decimal("50.00"), "BOB")
    # Solo esos campos: nada de quien paga.
    assert set(vars(pago)) == {"qr_id", "monto", "moneda", "fecha", "hora"}
    otro = pasarela.generar_qr(
        id_transaccion="ST-2", monto_bs=Decimal(1), descripcion="d", vence=date(2026, 11, 11)
    )
    pasarela.cancelar(otro.qr_id)
    assert pasarela.consultar(otro.qr_id).estado == "anulado"


def test_pu_baneco_07_si_la_ruta_v2_no_existe_usa_la_forma_del_manual_y_lo_registra(caplog):
    pasarela, banco, _ = armar()
    banco.v2 = False
    qr = generar(pasarela)
    with caplog.at_level(logging.INFO, logger="app.pagos.baneco"):
        assert pasarela.consultar(qr.qr_id).estado == "pendiente"
        pasarela.consultar(qr.qr_id)
    assert pasarela.variante_estado == "manual"
    assert caplog.messages == ["Estado del QR: funciona la variante manual"]
    # Una vez conocida la variante, no vuelve a probar la v2.
    assert banco.llamadas.count(f"GET api/qrsimple/v2/statusQR/{qr.qr_id}") == 1
    banco.pagar(qr.qr_id)
    assert [p.qr_id for p in pasarela.pagos_del_dia(date(2026, 11, 10))] == [qr.qr_id]
    assert pasarela.variante_pagados == "manual"


def test_pu_baneco_08_banco_caido_o_con_error_sin_filtrar_secretos(caplog):
    pasarela, banco, _ = armar()
    with caplog.at_level(logging.DEBUG):
        qr = generar(pasarela)
        banco.caido = True
        with pytest.raises(BancoNoDisponible) as caido:
            pasarela.consultar(qr.qr_id)
        banco.caido = False
        with pytest.raises(BancoNoDisponible) as rechazo:
            pasarela.consultar("QR-INEXISTENTE")
    assert str(caido.value) == "estado del QR: sin respuesta del banco"
    # Solo el responseCode, nunca el cuerpo ("no existe").
    assert str(rechazo.value) == "estado del QR: responseCode 3"
    textos = caplog.text + str(caido.value) + str(rechazo.value)
    token = next(iter(banco._tokens))
    for secreto in (*SECRETOS.values(), token, PNG):
        if secreto.startswith("https://"):
            continue
        assert secreto not in textos


def test_pu_baneco_09_la_api_no_arranca_con_baneco_sin_sus_variables(monkeypatch):
    from app.main import create_app

    monkeypatch.setenv("PAGOS_PROVEEDOR", "baneco")
    # Vacías en el entorno: tienen prioridad sobre cualquier .env local.
    for nombre in ("BANECO_API_URL", "BANECO_USUARIO", "BANECO_CONTRASENA", "BANECO_CUENTA"):
        monkeypatch.setenv(nombre, "")
    monkeypatch.setenv("BANECO_LLAVE_AES", LLAVE)
    with pytest.raises(ConfiguracionInvalida) as error:
        create_app()
    assert str(error.value) == (
        "PAGOS_PROVEEDOR=baneco, pero faltan estas variables: BANECO_API_URL, BANECO_USUARIO, "
        "BANECO_CONTRASENA, BANECO_CUENTA."
    )
    monkeypatch.setenv("PAGOS_PROVEEDOR", "otro")
    with pytest.raises(ConfiguracionInvalida):
        create_app()

