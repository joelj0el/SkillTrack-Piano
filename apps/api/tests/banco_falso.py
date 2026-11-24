"""Servidor FALSO de la API de pago QR del banco: las pruebas nunca llaman al banco real.

Se usa de dos formas:
- en pytest, con `httpx.MockTransport(banco.atender)`;
- en la E2E, como servidor HTTP (`python -m tests.banco_falso`), con rutas `/_control/...` para
  marcar un QR como pagado.

Descifra la contraseña y la cuenta con la llave para comprobar que el adaptador cifra bien.
Todos los datos son SINTÉTICOS.
"""

import base64
import json
import os
import time
from collections.abc import Callable
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from itertools import count

import httpx

from app.modules.plans.cifrado_baneco import descifrar

# PNG mínimo (1×1) para la imagen del QR.
PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="


def _token(vence: float) -> str:
    carga = base64.urlsafe_b64encode(json.dumps({"exp": int(vence)}).encode()).decode()
    return f"falso.{carga.rstrip('=')}.firma"


class BancoFalso:
    def __init__(
        self,
        *,
        usuario: str,
        contrasena: str,
        cuenta: str,
        llave: str,
        reloj: Callable[[], float] = time.time,
        vida_token: float = 30 * 60,
    ) -> None:
        self.usuario, self.contrasena, self.cuenta, self.llave = usuario, contrasena, cuenta, llave
        self.reloj = reloj
        self.vida_token = vida_token
        self.v2 = True
        self.caido = False
        self.rechazar_siguientes = 0  # respuestas 401 a dar con un token válido
        self.autenticaciones = 0
        self.llamadas: list[str] = []
        self.qrs: dict[str, dict] = {}
        self._tokens: dict[str, float] = {}
        self._numero = count(1)

    # --- Control de la prueba --------------------------------------------------------------

    def pagar(self, qr_id: str, monto: Decimal | None = None, moneda: str = "BOB") -> None:
        qr = self.qrs[qr_id]
        qr["estado"] = 1
        qr["pagos"].append(
            {
                "qrId": qr_id,
                "transactionId": f"BCO-{next(self._numero)}",
                "paymentDate": "2026-11-10",
                "paymentTime": "10:15:00",
                "currency": moneda,
                "amount": float(monto if monto is not None else qr["amount"]),
                # Datos de quien paga: el sistema no debe guardarlos.
                "senderBankCode": "999",
                "senderName": "PERSONA SINTETICA",
                "senderDocumentId": "0000000",
                "senderAccount": "000000000",
            }
        )

    def qr_de_transaccion(self, transaction_id: str) -> str:
        return next(q for q, d in self.qrs.items() if d["transactionId"] == transaction_id)

    # --- API -------------------------------------------------------------------------------

    @staticmethod
    def _json(estado: int, cuerpo: dict) -> httpx.Response:
        return httpx.Response(estado, json=cuerpo)

    def _ok(self, **datos) -> httpx.Response:
        return self._json(200, {"responseCode": 0, "message": "", **datos})

    def _autorizado(self, request: httpx.Request) -> bool:
        token = request.headers.get("authorization", "").removeprefix("Bearer ")
        return self._tokens.get(token, 0) > self.reloj()

    def atender(self, request: httpx.Request) -> httpx.Response:
        if self.caido:
            raise httpx.ConnectError("banco caído", request=request)
        ruta = request.url.path.split("/ApiGateway/", 1)[-1]
        self.llamadas.append(f"{request.method} {ruta}")
        cuerpo = json.loads(request.content) if request.content else {}

        if ruta == "api/authentication/authenticate":
            self.autenticaciones += 1
            if cuerpo.get("userName") != self.usuario or (
                descifrar(cuerpo.get("password", ""), self.llave) != self.contrasena
            ):
                return self._json(200, {"responseCode": 1, "message": "credenciales"})
            vence = self.reloj() + self.vida_token
            token = _token(vence)
            self._tokens[token] = vence
            return self._ok(token=token)

        if not self._autorizado(request):
            return self._json(401, {"message": "token"})
        if self.rechazar_siguientes:
            self.rechazar_siguientes -= 1
            return self._json(401, {"message": "token"})

        if ruta == "api/qrsimple/generateQR" and request.method == "POST":
            return self._generar(cuerpo)
        if ruta.startswith("api/qrsimple/v2/statusQR/"):
            if not self.v2:
                return self._json(404, {})
            return self._estado(ruta.rsplit("/", 1)[-1])
        if ruta == "api/qrsimple/statusQR":
            return self._estado(cuerpo.get("qrId", ""))
        if ruta == "api/qrsimple/cancelQR" and request.method == "DELETE":
            self.qrs[cuerpo["qrId"]]["estado"] = 9
            return self._ok()
        if ruta.startswith("api/qrsimple/v2/paidQR/"):
            if not self.v2:
                return self._json(405, {})
            return self._ok(paymentList=[p for q in self.qrs.values() for p in q["pagos"]])
        if ruta == "api/qrsimple/paidQR":
            return self._ok(paymentList=[p for q in self.qrs.values() for p in q["pagos"]])
        return self._json(404, {})

    def _generar(self, c: dict) -> httpx.Response:
        valido = (
            descifrar(c.get("accountCredit", ""), self.llave) == self.cuenta
            and c.get("currency") == "BOB"
            and c.get("singleUse") is True
            and c.get("modifyAmount") is False
            and "branchCode" not in c
            and Decimal(str(c.get("amount")))
            == Decimal(str(c.get("amount"))).quantize(Decimal("0.01"))
        )
        if not valido:
            return self._json(200, {"responseCode": 2, "message": "datos"})
        qr_id = f"QR{next(self._numero):06d}"
        self.qrs[qr_id] = {
            "transactionId": c["transactionId"],
            "amount": Decimal(str(c["amount"])),
            "description": c.get("description"),
            "dueDate": c.get("dueDate"),
            "estado": 0,
            "pagos": [],
        }
        return self._ok(qrId=qr_id, qrImage=PNG)

    def _estado(self, qr_id: str) -> httpx.Response:
        qr = self.qrs.get(qr_id)
        if qr is None:
            return self._json(200, {"responseCode": 3, "message": "no existe"})
        # Nombres con otra capitalización: el adaptador los lee sin distinguir mayúsculas.
        return self._ok(StatusQRCode=qr["estado"], Payment=qr["pagos"])


# --- Servidor HTTP para la E2E -------------------------------------------------------------------


def servir(banco: BancoFalso, puerto: int) -> None:
    class Manejador(BaseHTTPRequestHandler):
        def _responder(self) -> None:
            largo = int(self.headers.get("content-length") or 0)
            contenido = self.rfile.read(largo) if largo else b""
            if self.path.startswith("/_control/pagar"):
                datos = json.loads(contenido or b"{}")
                banco.pagar(banco.qr_de_transaccion(datos["transactionId"]))
                respuesta = httpx.Response(200, json={"ok": True})
            else:
                peticion = httpx.Request(
                    self.command,
                    f"http://banco-falso{self.path}",
                    headers=dict(self.headers),
                    content=contenido,
                )
                respuesta = banco.atender(peticion)
            self.send_response(respuesta.status_code)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(respuesta.content)))
            self.end_headers()
            self.wfile.write(respuesta.content)

        do_GET = do_POST = do_DELETE = _responder

        def log_message(self, *_: object) -> None:  # sin registro de cuerpos ni rutas
            return

    ThreadingHTTPServer(("0.0.0.0", puerto), Manejador).serve_forever()


if __name__ == "__main__":
    servir(
        BancoFalso(
            usuario=os.environ["BANECO_USUARIO"],
            contrasena=os.environ["BANECO_CONTRASENA"],
            cuenta=os.environ["BANECO_CUENTA"],
            llave=os.environ["BANECO_LLAVE_AES"],
        ),
        int(os.environ.get("BANCO_FALSO_PUERTO", "8080")),
    )
