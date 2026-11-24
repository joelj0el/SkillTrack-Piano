"""Configuración del proveedor de pagos por QR (ADR-004).

Con `PAGOS_PROVEEDOR=simulado` (predeterminado) no se necesita nada más. Con `baneco` deben estar
todas las variables del banco y la llave AES debe tener 32 caracteres; si no, la API no arranca y
el error nombra la variable, nunca su valor.
"""

from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.config import RAIZ_API

LONGITUD_LLAVE_AES = 32


class ConfiguracionInvalida(Exception):
    """El mensaje solo nombra variables: nunca incluye sus valores."""


class ConfiguracionPagos(BaseSettings):
    model_config = SettingsConfigDict(env_file=RAIZ_API / ".env", extra="ignore")

    pagos_proveedor: Literal["simulado", "baneco"] = "simulado"
    # SecretStr: aunque se imprima la configuración, los valores salen como "**********".
    baneco_api_url: SecretStr = SecretStr("")
    baneco_usuario: SecretStr = SecretStr("")
    baneco_contrasena: SecretStr = SecretStr("")
    baneco_cuenta: SecretStr = SecretStr("")
    baneco_llave_aes: SecretStr = SecretStr("")
    # Aviso de pago del banco: apagado por defecto; sin IPs permitidas, se rechaza todo aviso.
    baneco_aviso_activo: bool = False
    baneco_aviso_ips: str = Field(default="")

    @property
    def ips_del_aviso(self) -> frozenset[str]:
        return frozenset(ip.strip() for ip in self.baneco_aviso_ips.split(",") if ip.strip())


VARIABLES_BANECO = (
    "BANECO_API_URL",
    "BANECO_USUARIO",
    "BANECO_CONTRASENA",
    "BANECO_CUENTA",
    "BANECO_LLAVE_AES",
)


def cargar_configuracion_pagos() -> ConfiguracionPagos:
    """Lee y valida la configuración. Un valor no válido de PAGOS_PROVEEDOR también se informa
    sin mostrarlo."""
    try:
        config = ConfiguracionPagos()
    except Exception:
        raise ConfiguracionInvalida(
            "PAGOS_PROVEEDOR debe ser «simulado» o «baneco» (y BANECO_AVISO_ACTIVO, true o false)."
        ) from None
    validar(config)
    return config


def validar(config: ConfiguracionPagos) -> None:
    if config.pagos_proveedor != "baneco":
        return
    faltan = [
        nombre
        for nombre in VARIABLES_BANECO
        if not getattr(config, nombre.lower()).get_secret_value().strip()
    ]
    if faltan:
        raise ConfiguracionInvalida(
            f"PAGOS_PROVEEDOR=baneco, pero faltan estas variables: {', '.join(faltan)}."
        )
    if len(config.baneco_llave_aes.get_secret_value()) != LONGITUD_LLAVE_AES:
        raise ConfiguracionInvalida(f"BANECO_LLAVE_AES debe tener {LONGITUD_LLAVE_AES} caracteres.")
