from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.identity.models import Usuario
from app.semilla import sembrar
from tests.conftest import Reloj


def test_pu_api_09_la_semilla_de_demostracion_es_completa_e_idempotente(
    db: Session, cliente: TestClient, reloj: Reloj
):
    hoy = date(2026, 11, 10)
    assert sembrar(db, "clave-demo-larga", hoy) is True
    assert sembrar(db, "clave-demo-larga", hoy) is False
    assert db.scalar(select(func.count()).select_from(Usuario)) == 7

    docente = db.scalars(select(Usuario).where(Usuario.username == "docente.demo")).one()
    nombres = [e["usuario"] for e in como_con(cliente, docente).get("/api/mis-estudiantes").json()]
    assert sorted(nombres) == ["estudiante.demo", "estudiante2.demo"]

    ana = db.scalars(select(Usuario).where(Usuario.username == "estudiante.demo")).one()
    tareas = como_con(cliente, ana).get("/api/mis-tareas").json()
    assert [t["estado"] for t in tareas].count("Vencida") == 1
    assert sum(len(t["observaciones"]) for t in tareas) >= 3


def como_con(cliente: TestClient, usuario: Usuario) -> TestClient:
    cliente.cookies.clear()
    respuesta = cliente.post(
        "/api/auth/login", json={"usuario": usuario.username, "clave": "clave-demo-larga"}
    )
    assert respuesta.status_code == 200, respuesta.text
    return cliente
