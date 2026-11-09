from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, MetaData, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import obtener_configuracion

ESQUEMA = "app"


class Base(DeclarativeBase):
    metadata = MetaData(schema=ESQUEMA)


@lru_cache
def _engine(url: str) -> Engine:
    return create_engine(url, pool_pre_ping=True)


def crear_engine() -> Engine:
    return _engine(obtener_configuracion().database_url)


def obtener_db() -> Iterator[Session]:
    with sessionmaker(crear_engine(), expire_on_commit=False)() as sesion:
        yield sesion
