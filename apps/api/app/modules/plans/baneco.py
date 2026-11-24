"""Adaptador de pago QR del Banco Económico (API Market), detrás de `PasarelaQr` (ADR-004).

- Autenticación con usuario y contraseña cifrada; el token (JWT de 30 min) vive solo en memoria y
  se renueva 5 min antes de vencer. Ante un 401, se renueva y se reintenta una vez.
- La cuenta y la contraseña se cifran en memoria en cada uso (`cifrado_baneco`).
- Estado: primero la ruta v2 (`statusQR/{qrId}`); si responde 404 o 405, la forma con cuerpo. En
  el registro solo queda cuál variante funcionó.
- Nunca se escriben en el registro ni en los errores la llave, la contraseña, la cuenta (en claro
  o cifrada), el token, la imagen del QR ni los cuerpos de respuesta: solo el código HTTP y el
  responseCode.
"""

import base64
import json
import logging
import time
from collections.abc import Callable, Mapping
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Literal

import httpx

from app.core.config_pagos import ConfiguracionPagos
from app.modules.plans.cifrado_baneco import cifrar
from app.modules.plans.pagos import (
    MONEDA,
    BancoNoDisponible,
    EstadoBanco,
    EstadoQr,
    PagoRecibido,
    QrGenerado,
)

registro = logging.getLogger("app.pagos.baneco")

TIEMPO_LIMITE_S = 15.0
# Renovar el token 5 minutos antes de que venza; si no trae "exp", se asume 30 minutos.
MARGEN_TOKEN_S = 5 * 60
VIDA_TOKEN_S = 30 * 60
ESTADOS_QR: dict[int, EstadoBanco] = {0: "pendiente", 1: "pagado", 9: "anulado"}


def campo(datos: Mapping[str, Any], nombre: str) -> Any:
    """Lee un campo sin distinguir mayúsculas (el banco no es uniforme)."""
    buscado = nombre.lower()
    for clave, valor in datos.items():
        if clave.lower() == buscado:
            return valor
    return None


def _vence_del_token(token: str) -> float | None:
    try:
        carga = token.split(".")[1]
        carga += "=" * (-len(carga) % 4)
        exp = json.loads(base64.urlsafe_b64decode(carga)).get("exp")
        return float(exp) if exp is not None else None
    except (IndexError, ValueError, AttributeError):
        return None


def _monto(valor: Decimal) -> float:
    return float(valor.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def pago_recibido(datos: Mapping[str, Any]) -> PagoRecibido:
    """Solo qrId, monto, moneda, fecha y hora: los datos de quien paga no se leen."""
    monto = campo(datos, "amount")
    return PagoRecibido(
        qr_id=str(campo(datos, "qrId") or ""),
        monto=Decimal(str(monto)).quantize(Decimal("0.01")) if monto is not None else Decimal(-1),
        moneda=str(campo(datos, "currency") or ""),
        fecha=_texto(campo(datos, "paymentDate")),
        hora=_texto(campo(datos, "paymentTime")),
    )


def _texto(valor: Any) -> str | None:
    return None if valor is None else str(valor)[:20]


class PasarelaBaneco:
    proveedor: Literal["simulado", "baneco"] = "baneco"

    def __init__(
        self,
        config: ConfiguracionPagos,
        cliente: httpx.Client | None = None,
        reloj: Callable[[], float] = time.time,
    ) -> None:
        self._config = config
        self._base = config.baneco_api_url.get_secret_value().rstrip("/") + "/"
        self._cliente = cliente or httpx.Client(timeout=TIEMPO_LIMITE_S)
        self._reloj = reloj
        self._token: str | None = None
        self._token_vence = 0.0
        # "v2" o "manual": la variante de la consulta de estado que respondió.
        self.variante_estado: str | None = None
        self.variante_pagados: str | None = None

    # --- Transporte ------------------------------------------------------------------------

    def _cifrado(self, valor: str) -> str:
        return cifrar(valor, self._config.baneco_llave_aes.get_secret_value())

    def _enviar(self, metodo: str, ruta: str, operacion: str, **opciones: Any) -> httpx.Response:
        try:
            return self._cliente.request(metodo, self._base + ruta, **opciones)
        except httpx.HTTPError:
            raise BancoNoDisponible(f"{operacion}: sin respuesta del banco") from None

    @staticmethod
    def _cuerpo(respuesta: httpx.Response, operacion: str) -> dict[str, Any]:
        if respuesta.status_code >= 400:
            raise BancoNoDisponible(f"{operacion}: HTTP {respuesta.status_code}")
        try:
            datos = respuesta.json()
        except ValueError:
            raise BancoNoDisponible(f"{operacion}: respuesta no válida") from None
        if not isinstance(datos, dict):
            raise BancoNoDisponible(f"{operacion}: respuesta no válida")
        codigo = campo(datos, "responseCode")
        if codigo not in (0, "0"):
            raise BancoNoDisponible(f"{operacion}: responseCode {codigo}")
        return datos

    def _autenticar(self) -> None:
        respuesta = self._enviar(
            "POST",
            "api/authentication/authenticate",
            "autenticación",
            json={
                "userName": self._config.baneco_usuario.get_secret_value(),
                "password": self._cifrado(self._config.baneco_contrasena.get_secret_value()),
            },
        )
        token = campo(self._cuerpo(respuesta, "autenticación"), "token")
        if not isinstance(token, str) or not token:
            raise BancoNoDisponible("autenticación: sin token")
        self._token = token
        self._token_vence = _vence_del_token(token) or self._reloj() + VIDA_TOKEN_S

    def _pedir(self, metodo: str, ruta: str, operacion: str, **opciones: Any) -> httpx.Response:
        """Con el token vigente; ante un 401, lo renueva y reintenta una sola vez."""
        if self._token is None or self._reloj() >= self._token_vence - MARGEN_TOKEN_S:
            self._autenticar()
        respuesta = self._enviar(metodo, ruta, operacion, headers=self._cabeceras(), **opciones)
        if respuesta.status_code == 401:
            self._autenticar()
            respuesta = self._enviar(metodo, ruta, operacion, headers=self._cabeceras(), **opciones)
        return respuesta

    def _cabeceras(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._token}"}

    # --- Operaciones -----------------------------------------------------------------------

    def generar_qr(
        self, *, id_transaccion: str, monto_bs: Decimal, descripcion: str, vence: date
    ) -> QrGenerado:
        respuesta = self._pedir(
            "POST",
            "api/qrsimple/generateQR",
            "generar QR",
            json={
                "transactionId": id_transaccion,
                "accountCredit": self._cifrado(self._config.baneco_cuenta.get_secret_value()),
                "currency": MONEDA,
                "amount": _monto(monto_bs),
                "description": descripcion,
                "dueDate": vence.isoformat(),
                "singleUse": True,
                "modifyAmount": False,
            },
        )
        datos = self._cuerpo(respuesta, "generar QR")
        qr_id, imagen = campo(datos, "qrId"), campo(datos, "qrImage")
        if not qr_id or not isinstance(imagen, str):
            raise BancoNoDisponible("generar QR: respuesta incompleta")
        return QrGenerado(id_transaccion, str(qr_id), imagen, vence)

    def _con_respaldo(
        self, actual: str | None, v2: tuple[str, dict], manual: tuple[str, dict], operacion: str
    ) -> tuple[httpx.Response, str]:
        """Prueba la ruta v2 y, si responde 404 o 405, la forma con cuerpo del manual."""
        if actual != "manual":
            respuesta = self._pedir("GET", v2[0], operacion, **v2[1])
            if respuesta.status_code not in (404, 405):
                return respuesta, "v2"
        return self._pedir("GET", manual[0], operacion, **manual[1]), "manual"

    def consultar(self, qr_id: str) -> EstadoQr:
        respuesta, variante = self._con_respaldo(
            self.variante_estado,
            (f"api/qrsimple/v2/statusQR/{qr_id}", {}),
            ("api/qrsimple/statusQR", {"json": {"qrId": qr_id}}),
            "estado del QR",
        )
        datos = self._cuerpo(respuesta, "estado del QR")
        if self.variante_estado != variante:
            self.variante_estado = variante
            registro.info("Estado del QR: funciona la variante %s", variante)
        codigo = campo(datos, "statusQrCode")
        try:
            estado = ESTADOS_QR.get(int(codigo), "pendiente")
        except (TypeError, ValueError):
            estado = "pendiente"
        pagos = campo(datos, "payment") or []
        if isinstance(pagos, dict):
            pagos = [pagos]
        return EstadoQr(estado, tuple(pago_recibido(p) for p in pagos if isinstance(p, dict)))

    def cancelar(self, qr_id: str) -> None:
        respuesta = self._pedir(
            "DELETE", "api/qrsimple/cancelQR", "anular QR", json={"qrId": qr_id}
        )
        self._cuerpo(respuesta, "anular QR")

    def pagos_del_dia(self, dia: date) -> list[PagoRecibido]:
        """Conciliación: los QR pagados en el día."""
        respuesta, variante = self._con_respaldo(
            self.variante_pagados,
            (f"api/qrsimple/v2/paidQR/{dia:%Y%m%d}", {}),
            ("api/qrsimple/paidQR", {"json": {"paymentDate": dia.isoformat()}}),
            "pagos del día",
        )
        datos = self._cuerpo(respuesta, "pagos del día")
        self.variante_pagados = variante
        lista = campo(datos, "paymentList") or []
        return [pago_recibido(p) for p in lista if isinstance(p, dict)]
