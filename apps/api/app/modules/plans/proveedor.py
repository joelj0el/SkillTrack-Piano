"""Elige el proveedor de pagos por QR al arrancar la API (PAGOS_PROVEEDOR)."""

from app.core.config_pagos import ConfiguracionPagos
from app.modules.plans.baneco import PasarelaBaneco
from app.modules.plans.pagos import PasarelaQr, PasarelaSimulada


def construir_pasarela(config: ConfiguracionPagos) -> PasarelaQr:
    if config.pagos_proveedor == "baneco":
        return PasarelaBaneco(config)
    return PasarelaSimulada()
