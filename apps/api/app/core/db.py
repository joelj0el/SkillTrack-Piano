from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import obtener_configuracion


class Base(DeclarativeBase):
    pass


def crear_engine() -> Engine:
    return create_engine(obtener_configuracion().database_url, pool_pre_ping=True)
