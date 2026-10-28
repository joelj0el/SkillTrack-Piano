from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

RAIZ_API = Path(__file__).resolve().parents[2]


class Configuracion(BaseSettings):
    model_config = SettingsConfigDict(env_file=RAIZ_API / ".env", extra="ignore")

    database_url: str


def obtener_configuracion() -> Configuracion:
    return Configuracion()
