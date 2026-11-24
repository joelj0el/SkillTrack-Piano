"""Prueba MANUAL del pago por QR con el banco real: `pnpm baneco:probar --monto 1`.

Autentica, genera un QR del monto indicado, lo guarda como PNG en apps/api/.baneco/ (ignorada por
git), muestra la ruta y consulta el estado cada 5 s durante 3 minutos. Al final dice qué variante
de la consulta de estado funcionó. Con `--anular <qrId>` anula un QR.

Lee las variables BANECO_ del entorno o de apps/api/.env. Nunca muestra sus valores, el token ni
la imagen: solo la ruta del PNG, el qrId y los estados. No lo usan las pruebas automáticas ni la CI.
"""

import argparse
import base64
import sys
import time
from collections.abc import Callable
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path
from uuid import uuid4

from app.core.config import RAIZ_API
from app.core.config_pagos import ConfiguracionInvalida, ConfiguracionPagos, validar
from app.core.reloj import hoy_local
from app.modules.plans.baneco import PasarelaBaneco
from app.modules.plans.pagos import BancoNoDisponible

CARPETA = RAIZ_API / ".baneco"
TEXTO_ESTADO = {"pendiente": "pendiente", "pagado": "PAGADO", "anulado": "anulado"}


def probar(
    pasarela: PasarelaBaneco,
    monto: Decimal,
    carpeta: Path,
    ahora: datetime,
    *,
    esperar: Callable[[float], None] = time.sleep,
    intervalo: float = 5,
    duracion: float = 180,
    salida: Callable[[str], None] = print,
) -> str:
    """Devuelve el último estado ("pendiente", "pagado" o "anulado")."""
    id_transaccion = f"PRUEBA-{uuid4().hex[:12].upper()}"
    qr = pasarela.generar_qr(
        id_transaccion=id_transaccion,
        monto_bs=monto,
        descripcion="SkillTrack-Piano – prueba manual",
        vence=hoy_local(ahora) + timedelta(days=1),
    )
    carpeta.mkdir(parents=True, exist_ok=True)
    archivo = carpeta / f"qr-{id_transaccion}.png"
    archivo.write_bytes(base64.b64decode(qr.imagen or ""))
    salida(f"QR de Bs {monto} guardado en: {archivo}")
    salida(f"qrId: {qr.qr_id} (para anularlo: pnpm baneco:probar --anular {qr.qr_id})")
    estado = "pendiente"
    for _ in range(max(1, int(duracion // intervalo))):
        estado = pasarela.consultar(qr.qr_id).estado
        salida(TEXTO_ESTADO[estado])
        if estado != "pendiente":
            break
        esperar(intervalo)
    salida(f"Variante de la consulta de estado que funcionó: {pasarela.variante_estado}")
    return estado


def anular(pasarela: PasarelaBaneco, qr_id: str, salida: Callable[[str], None] = print) -> None:
    pasarela.cancelar(qr_id)
    salida(f"QR {qr_id} anulado.")


def main(argv: list[str] | None = None) -> int:
    # En la consola de Windows, las tildes salen bien solo en UTF-8.
    for flujo in (sys.stdout, sys.stderr):
        if hasattr(flujo, "reconfigure"):
            flujo.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(prog="pnpm baneco:probar", description=__doc__)
    grupo = parser.add_mutually_exclusive_group(required=True)
    grupo.add_argument("--monto", help="monto en Bs del QR de prueba, por ejemplo 1")
    grupo.add_argument("--anular", metavar="QRID", help="anula el QR indicado")
    args = parser.parse_args(argv)
    try:
        config = ConfiguracionPagos()
        validar(config.model_copy(update={"pagos_proveedor": "baneco"}))
    except ConfiguracionInvalida as error:
        print(error, file=sys.stderr)
        return 2
    pasarela = PasarelaBaneco(config)
    try:
        if args.anular:
            anular(pasarela, args.anular)
            return 0
        try:
            monto = Decimal(args.monto)
        except InvalidOperation:
            print("--monto debe ser un número, por ejemplo 1", file=sys.stderr)
            return 2
        probar(pasarela, monto, CARPETA, datetime.now().astimezone())
    except BancoNoDisponible as error:
        print(f"El banco no respondió como se esperaba: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
