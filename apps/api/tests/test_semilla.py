from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.attempts.models import Intento
from app.modules.identity.models import Usuario
from app.semilla import MARCA_DEMO, sembrar, sembrar_intentos_demo, sembrar_planes
from tests.conftest import Reloj


def test_pu_api_09_la_semilla_de_demostracion_es_completa_e_idempotente(
    db: Session, cliente: TestClient, reloj: Reloj
):
    hoy = date(2026, 11, 10)
    assert sembrar(db, "clave-demo-larga", hoy) is True
    assert sembrar(db, "clave-demo-larga", hoy) is False
    assert db.scalar(select(func.count()).select_from(Usuario)) == 8
    # El superadministrador publica la referencia y las reglas; no pertenece a ninguna institución.
    superadmin = db.scalars(select(Usuario).where(Usuario.superadmin)).one()
    assert superadmin.username == "superadmin.demo"

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


def test_pu_api_11_la_semilla_agrega_intentos_de_demostracion_marcados_en_varias_semanas(
    db: Session, cliente: TestClient, reloj: Reloj
):
    hoy = date(2026, 11, 10)
    sembrar(db, "clave-demo-larga", hoy)
    creados = sembrar_intentos_demo(db, hoy)
    assert creados > 0
    assert sembrar_intentos_demo(db, hoy) == 0

    intentos = list(db.scalars(select(Intento)))
    assert len(intentos) == creados
    # Todos marcados como datos de demostración y fuera del conteo de las tareas.
    assert {i.clase_dispositivo for i in intentos} == {MARCA_DEMO}
    assert {i.version_nucleo for i in intentos} == {MARCA_DEMO}
    assert not any(i.cuenta_para_tarea for i in intentos)

    ana = db.scalars(select(Usuario).where(Usuario.username == "estudiante.demo")).one()
    assert {i.estudiante_id for i in intentos} == {ana.id}
    semanas = como_con(cliente, ana).get("/api/tableros/mi-progreso").json()["semanas"]
    assert len({s["semana"] for s in semanas}) >= 4

    docente = db.scalars(select(Usuario).where(Usuario.username == "docente.demo")).one()
    grupo = como_con(cliente, docente).get("/api/tableros/mi-grupo").json()
    fila = next(e for e in grupo["estudiantes"] if e["estudiante_id"] == ana.id)
    assert fila["intentos_considerados"] == 10


def test_pu_api_12_la_semilla_carga_los_planes_sin_precios_ni_limites_inventados(
    db: Session, cliente: TestClient
):
    assert sembrar_planes(db) == 3
    assert sembrar_planes(db) == 0
    planes = cliente.get("/api/planes").json()
    assert [p["nombre"] for p in planes] == ["Docente", "Institución", "Convenio especial"]
    assert {p["precio_bs"] for p in planes} == {None}
    assert {p["limite_docentes"] for p in planes} == {None}
    assert {p["limite_estudiantes"] for p in planes} == {None}
    assert [p["destacado"] for p in planes] == [False, True, False]
