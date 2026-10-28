import os
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session
from testcontainers.community.postgres import PostgresContainer

from app.core.csrf import CABECERA_CSRF
from app.core.db import ESQUEMA, crear_engine
from app.core.reloj import ahora
from app.main import create_app
from tests import fabricas

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"

# Tablas con datos de referencia cargados por migración: no se vacían entre pruebas.
TABLAS_DE_REFERENCIA = {"ejercicio", "version_ejercicio", "clase_error"}


def alembic(url: str) -> Config:
    os.environ["DATABASE_URL"] = url
    return Config(str(ALEMBIC_INI))


@pytest.fixture(scope="session")
def url_postgres() -> Iterator[str]:
    with PostgresContainer("postgres:17.11", driver="psycopg") as postgres:
        yield postgres.get_connection_url()


@pytest.fixture(scope="session")
def url_migrada(url_postgres: str) -> str:
    command.upgrade(alembic(url_postgres), "head")
    return url_postgres


@pytest.fixture
def db(url_migrada: str) -> Iterator[Session]:
    engine = crear_engine()
    with Session(engine, expire_on_commit=False) as sesion:
        yield sesion
    with engine.begin() as conexion:
        tablas = conexion.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname = :e"), {"e": ESQUEMA}
        ).scalars()
        vaciar = [f"{ESQUEMA}.{t}" for t in tablas if t not in TABLAS_DE_REFERENCIA]
        if vaciar:
            conexion.execute(text(f"TRUNCATE {', '.join(vaciar)} RESTART IDENTITY CASCADE"))


class Reloj:
    def __init__(self) -> None:
        self.instante = datetime(2026, 11, 10, 12, 0, tzinfo=UTC)

    def avanzar(self, **delta: float) -> None:
        self.instante += timedelta(**delta)


@pytest.fixture
def reloj() -> Reloj:
    return Reloj()


@pytest.fixture
def cliente(db: Session, reloj: Reloj) -> Iterator[TestClient]:
    app = create_app()
    app.dependency_overrides[ahora] = lambda: reloj.instante
    with TestClient(app, base_url="https://testserver", headers={CABECERA_CSRF: "1"}) as c:
        yield c


def entrar(cliente: TestClient, usuario: str, clave: str = fabricas.CLAVE) -> TestClient:
    respuesta = cliente.post("/api/auth/login", json={"usuario": usuario, "clave": clave})
    assert respuesta.status_code == 200, respuesta.text
    return cliente
