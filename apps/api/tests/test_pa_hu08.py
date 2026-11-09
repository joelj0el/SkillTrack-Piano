import json
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.attempts.models import Intento
from tests import escenario
from tests.conftest import como
from tests.test_pa_hu14 import tarea_nueva


def resultado(**cambios) -> dict:
    datos = {
        "client_uuid": str(uuid.uuid4()),
        "version_ejercicio_id": 1,
        "tarea_id": None,
        "version_nucleo": "0.1.0",
        "version_modelo_mano": "hand_landmarker@prueba",
        "instrumento": "digital",
        "manos": "MD",
        "clase_dispositivo": "Android/Chrome",
        "modo": "V",
        "modo_metronomo": None,
        "tempo_elegido_bpm": 60,
        "estado": "evaluado",
        "motivo_no_evaluable": None,
        "iniciado_en": "2026-11-10T16:00:00Z",
        "duracion_ms": 9000,
        "pct_eventos_evaluables": 90.0,
        "pct_digitacion_correcta": 80.0,
        "eventos": [],
    }
    datos.update(cambios)
    return datos


def contar(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(Intento)) or 0


def test_pa_hu08_01_mismo_client_uuid_una_sola_fila_201_y_luego_200(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    como(cliente, e.estudiante_a)
    cuerpo = resultado()

    primera = cliente.post("/api/intentos", json=cuerpo)
    segunda = cliente.post("/api/intentos", json=cuerpo)

    assert (primera.status_code, segunda.status_code) == (201, 200)
    assert primera.json()["id"] == segunda.json()["id"]
    assert contar(db) == 1


@pytest.mark.parametrize(
    "tipo", ["multipart/form-data; boundary=x", "audio/webm", "video/mp4", "image/jpeg"]
)
def test_pa_hu08_02_binarios_reciben_415_y_no_se_guarda_nada(
    cliente: TestClient, db: Session, tipo: str
):
    e = escenario.crear(db)
    como(cliente, e.estudiante_a)

    respuesta = cliente.post(
        "/api/intentos", content=json.dumps(resultado()).encode(), headers={"content-type": tipo}
    )

    assert respuesta.status_code == 415
    assert contar(db) == 0


def test_pa_hu08_02_cuerpo_mayor_a_256_kb_recibe_413(cliente: TestClient, db: Session):
    e = escenario.crear(db)
    como(cliente, e.estudiante_a)
    grande = resultado(clase_dispositivo="x" * (256 * 1024))

    respuesta = cliente.post("/api/intentos", json=grande)

    assert respuesta.status_code == 413
    assert contar(db) == 0


def test_pa_hu08_05_intento_de_tarea_con_sus_campos_y_403_para_docente_ajeno(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    tarea_id = (
        como(cliente, e.docente_a)
        .post("/api/tareas", json=tarea_nueva(e.estudiante_a.id))
        .json()["id"]
    )
    como(cliente, e.estudiante_a)
    guardado = cliente.post(
        "/api/intentos",
        json=resultado(
            tarea_id=tarea_id,
            manos="juntas",
            instrumento="acustico",
            estado="no_evaluable",
            motivo_no_evaluable="Se movió la cámara",
        ),
    ).json()

    intento = como(cliente, e.docente_a).get(f"/api/intentos/{guardado['id']}").json()
    assert intento["tarea_id"] == tarea_id
    assert (intento["instrumento"], intento["manos"]) == ("acustico", "juntas")
    assert intento["tempo_elegido_bpm"] == 60
    assert intento["modo_metronomo"] is None  # Sin audio en la It-2.
    assert intento["version_nucleo"] and intento["version_modelo_mano"]
    assert (intento["estado"], intento["motivo_no_evaluable"]) == (
        "no_evaluable",
        "Se movió la cámara",
    )
    assert intento["cuenta_para_tarea"] is False

    for ajeno in (e.docente_a2, e.docente_b):
        respuesta = como(cliente, ajeno).get(f"/api/intentos/{guardado['id']}")
        assert respuesta.status_code == 403, ajeno.username


def test_pa_hu05_05_el_intento_registra_versiones_de_nucleo_y_modelo_de_mano(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    como(cliente, e.estudiante_a)

    for campo in ("version_nucleo", "version_modelo_mano"):
        assert cliente.post("/api/intentos", json=resultado(**{campo: ""})).status_code == 422
    cliente.post("/api/intentos", json=resultado())
    guardado = db.scalars(select(Intento)).one()
    assert guardado.version_nucleo == "0.1.0"
    assert guardado.version_modelo_mano == "hand_landmarker@prueba"


def test_pu_attempts_01_solo_un_estudiante_guarda_y_otro_estudiante_recibe_404(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    assert como(cliente, e.docente_a).post("/api/intentos", json=resultado()).status_code == 403
    intento_id = como(cliente, e.estudiante_a).post("/api/intentos", json=resultado()).json()["id"]

    assert como(cliente, e.estudiante_b).get(f"/api/intentos/{intento_id}").status_code == 404
    assert [i["id"] for i in como(cliente, e.estudiante_a).get("/api/mis-intentos").json()] == [
        intento_id
    ]


def test_pu_attempts_02_un_intento_con_campos_extra_se_rechaza(cliente: TestClient, db: Session):
    e = escenario.crear(db)
    como(cliente, e.estudiante_a)

    respuesta = cliente.post("/api/intentos", json=resultado(video="AAAA"))

    assert respuesta.status_code == 422
    assert contar(db) == 0
