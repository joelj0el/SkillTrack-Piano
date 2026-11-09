from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests import escenario
from tests.conftest import Reloj, como
from tests.test_pa_hu14 import tarea_nueva


def test_pu_pedagogy_06_mis_tareas_ordenadas_por_plazo_con_estado_vencida(
    cliente: TestClient, db: Session, reloj: Reloj
):
    e = escenario.crear(db)
    como(cliente, e.docente_a)
    for plazo in ("2026-11-20", "2026-11-12", "2026-11-15"):
        cliente.post("/api/tareas", json=tarea_nueva(e.estudiante_a.id, fecha_limite=plazo))

    reloj.avanzar(days=3)  # 2026-11-13: la del 12 queda vencida.
    tareas = como(cliente, e.estudiante_a).get("/api/mis-tareas").json()

    assert [t["fecha_limite"] for t in tareas] == ["2026-11-12", "2026-11-15", "2026-11-20"]
    assert [t["estado"] for t in tareas] == ["Vencida", "Asignada", "Asignada"]
    for t in tareas:
        assert {"ejercicio", "manos", "tempo_min_bpm", "repeticiones_por_dia"} <= t.keys()


def test_pa_hu29_03_tarea_u_observacion_de_otro_estudiante_da_404(cliente: TestClient, db: Session):
    e = escenario.crear(db)
    como(cliente, e.docente_a)
    tarea_id = cliente.post("/api/tareas", json=tarea_nueva(e.estudiante_a.id)).json()["id"]
    obs_id = cliente.post(
        "/api/observaciones", json={"tarea_id": tarea_id, "texto": "Mejora el pulso"}
    ).json()["id"]

    como(cliente, e.estudiante_a)
    assert cliente.get(f"/api/tareas/{tarea_id}").status_code == 200
    assert cliente.get(f"/api/observaciones/{obs_id}").status_code == 200

    for otro in (e.estudiante_a2, e.estudiante_b):
        como(cliente, otro)
        assert cliente.get(f"/api/tareas/{tarea_id}").status_code == 404, otro.username
        assert cliente.get(f"/api/observaciones/{obs_id}").status_code == 404, otro.username
        # Misma respuesta que un id que no existe: no revela que la tarea existe.
        assert (
            cliente.get("/api/tareas/999999").json()
            == cliente.get(f"/api/tareas/{tarea_id}").json()
        )


def test_pu_pedagogy_07_el_estudiante_sin_tareas_recibe_lista_vacia(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)

    assert como(cliente, e.estudiante_a2).get("/api/mis-tareas").json() == []


def test_pu_pedagogy_08_docente_ajeno_recibe_403_al_ver_la_tarea(cliente: TestClient, db: Session):
    e = escenario.crear(db)
    tarea_id = (
        como(cliente, e.docente_a)
        .post("/api/tareas", json=tarea_nueva(e.estudiante_a.id))
        .json()["id"]
    )

    for ajeno in (e.docente_a2, e.docente_b):
        assert como(cliente, ajeno).get(f"/api/tareas/{tarea_id}").status_code == 403
        lista = como(cliente, ajeno).get(f"/api/estudiantes/{e.estudiante_a.id}/tareas")
        assert lista.status_code == 403
