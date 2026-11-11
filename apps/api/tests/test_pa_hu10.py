from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests import escenario
from tests.conftest import como
from tests.test_pa_hu08 import resultado
from tests.test_pa_hu14 import tarea_nueva


def medido(tempo: float | None, **cambios) -> dict:
    """Intento v2 evaluado con audio y el tempo medido indicado."""
    return {
        "version": 2,
        **resultado(modo="VA", modo_metronomo="sin", **cambios),
        "tempo_medido_bpm": tempo,
        "referencia_temporal": "tempo_inicial" if tempo else None,
        "cambio_tempo_pct": 1.5 if tempo else None,
        "audio_sin_procesar": True,
    }


def tarea(cliente: TestClient, e) -> int:
    return (
        como(cliente, e.docente_a)
        .post("/api/tareas", json=tarea_nueva(e.estudiante_a.id))
        .json()["id"]
    )


def test_pa_hu10_05_tempo_medido_fuera_del_rango_no_cuenta_y_dice_por_que(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    tarea_id = tarea(cliente, e)
    como(cliente, e.estudiante_a)
    r = cliente.post("/api/intentos", json=medido(55.2, tarea_id=tarea_id))
    assert r.status_code == 201, r.text
    assert r.json()["cuenta_para_tarea"] is False
    assert r.json()["motivo_no_cuenta"] == "Tocaste a ♩≈55; tu tarea pide 60–70"

    dentro = cliente.post("/api/intentos", json=medido(64.6, tarea_id=tarea_id)).json()
    assert (dentro["cuenta_para_tarea"], dentro["motivo_no_cuenta"]) == (True, None)
    assert dentro["tempo_medido_bpm"] == 64.6


def test_pu_attempts_06_el_servidor_decide_si_cuenta_sin_confiar_en_el_cliente(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    tarea_id = tarea(cliente, e)
    como(cliente, e.estudiante_a)
    casos = {
        "Sin tempo medido": medido(None, tarea_id=tarea_id),
        "Práctica lenta": medido(45, tarea_id=tarea_id, tempo_elegido_bpm=45),
        "Intento no evaluable": medido(
            64, tarea_id=tarea_id, estado="no_evaluable", motivo_no_evaluable="x"
        ),
        "Intento libre, sin tarea": medido(64),
    }
    for motivo, cuerpo in casos.items():
        guardado = cliente.post("/api/intentos", json=cuerpo).json()
        assert (guardado["cuenta_para_tarea"], guardado["motivo_no_cuenta"]) == (False, motivo)
