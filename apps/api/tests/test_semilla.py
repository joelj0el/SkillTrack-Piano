from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.identity.models import Usuario
from app.semilla import sembrar
from tests.conftest import entrar


def test_pu_api_09_la_semilla_de_demostracion_es_idempotente(db: Session, cliente: TestClient):
    assert sembrar(db, "clave-demo-larga", date(2026, 11, 10)) is True
    assert sembrar(db, "clave-demo-larga", date(2026, 11, 10)) is False
    assert db.scalar(select(func.count()).select_from(Usuario)) == 4

    entrar(cliente, "docente.demo", "clave-demo-larga")
    [estudiante] = cliente.get("/api/mis-estudiantes").json()
    assert estudiante["usuario"] == "estudiante.demo"
