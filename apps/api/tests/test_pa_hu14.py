import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.audit.models import AuditoriaAcceso
from app.modules.pedagogy.models import Observacion, Tarea
from tests import escenario
from tests.conftest import Reloj, como

# El reloj de las pruebas está en 2026-11-10 (hora de La Paz).
PLAZO = "2026-11-17"


def tarea_nueva(estudiante_id: int, **cambios) -> dict:
    return {
        "estudiante_id": estudiante_id,
        "ejercicio_id": 1,
        "manos": "juntas",
        "tempo_min_bpm": 60,
        "tempo_max_bpm": 70,
        "repeticiones_por_dia": 3,
        "fecha_limite": PLAZO,
        **cambios,
    }


def test_pu_pedagogy_03_la_tarea_creada_lleva_los_cinco_datos_y_estado_asignada(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    como(cliente, e.docente_a)

    creada = cliente.post("/api/tareas", json=tarea_nueva(e.estudiante_a.id))
    assert creada.status_code == 201
    [tarea] = cliente.get(f"/api/estudiantes/{e.estudiante_a.id}/tareas").json()
    assert tarea["ejercicio"]["codigo"] == "EJ-01"
    assert (tarea["manos"], tarea["tempo_min_bpm"], tarea["tempo_max_bpm"]) == ("juntas", 60, 70)
    assert (tarea["fecha_limite"], tarea["repeticiones_por_dia"]) == (PLAZO, 3)
    assert tarea["estado"] == "Asignada"


@pytest.mark.parametrize(
    ("cambio", "campo"),
    [
        ({"tempo_min_bpm": 70, "tempo_max_bpm": 65}, "tempo_min_bpm"),
        ({"tempo_max_bpm": 80}, "tempo_max_bpm"),
        ({"tempo_min_bpm": 40}, "tempo_min_bpm"),
        ({"fecha_limite": "2026-11-09"}, "fecha_limite"),
        ({"repeticiones_por_dia": 0}, "repeticiones_por_dia"),
        ({"repeticiones_por_dia": 21}, "repeticiones_por_dia"),
    ],
)
def test_pa_hu14_02_condiciones_invalidas_dan_422_indicando_el_campo(
    cliente: TestClient, db: Session, cambio: dict, campo: str
):
    e = escenario.crear(db)
    como(cliente, e.docente_a)

    respuesta = cliente.post("/api/tareas", json=tarea_nueva(e.estudiante_a.id, **cambio))

    assert respuesta.status_code == 422
    assert any(campo in error["loc"] for error in respuesta.json()["detail"])


def test_pa_hu14_03_docente_sin_asignacion_recibe_403_y_queda_auditado(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    tarea = como(cliente, e.docente_a).post("/api/tareas", json=tarea_nueva(e.estudiante_a.id))

    for ajeno in (e.docente_a2, e.docente_b):
        como(cliente, ajeno)
        nueva = cliente.post("/api/tareas", json=tarea_nueva(e.estudiante_a.id))
        observacion = cliente.post(
            "/api/observaciones", json={"tarea_id": tarea.json()["id"], "texto": "Mejora…"}
        )
        assert (nueva.status_code, observacion.status_code) == (403, 403), ajeno.username

    assert db.scalar(select(Tarea.id).where(Tarea.docente_id != e.docente_a.id)) is None
    assert db.scalars(select(Observacion)).all() == []
    denegados = db.scalars(
        select(AuditoriaAcceso).where(AuditoriaAcceso.accion == "acceso_denegado")
    ).all()
    assert {r.actor_id for r in denegados} == {e.docente_a2.id, e.docente_b.id}


def test_pu_pedagogy_04_observacion_con_aspecto_opcional_y_hasta_1000_caracteres(
    cliente: TestClient, db: Session, reloj: Reloj
):
    e = escenario.crear(db)
    como(cliente, e.docente_a)
    tarea_id = cliente.post("/api/tareas", json=tarea_nueva(e.estudiante_a.id)).json()["id"]
    aspecto = cliente.get("/api/catalogo/taxonomia").json()[1]

    sin_aspecto = cliente.post("/api/observaciones", json={"tarea_id": tarea_id, "texto": "Uno"})
    reloj.avanzar(minutes=1)
    con_aspecto = cliente.post(
        "/api/observaciones",
        json={"tarea_id": tarea_id, "clase_error_id": aspecto["id"], "texto": "a" * 1000},
    )
    larga = cliente.post("/api/observaciones", json={"tarea_id": tarea_id, "texto": "a" * 1001})

    assert (sin_aspecto.status_code, con_aspecto.status_code, larga.status_code) == (201, 201, 422)
    assert con_aspecto.json()["aspecto"] == {"codigo": "ER-B", "nombre": "Desfase rítmico"}
    [tarea] = cliente.get(f"/api/estudiantes/{e.estudiante_a.id}/tareas").json()
    # De la más reciente a la más antigua.
    assert [o["texto"][:3] for o in tarea["observaciones"]] == ["aaa", "Uno"]


def test_pu_pedagogy_05_cambiar_y_cancelar_la_tarea(cliente: TestClient, db: Session):
    e = escenario.crear(db)
    como(cliente, e.docente_a)
    tarea_id = cliente.post("/api/tareas", json=tarea_nueva(e.estudiante_a.id)).json()["id"]

    cambiada = cliente.patch(
        f"/api/tareas/{tarea_id}",
        json={"tempo_min_bpm": 65, "tempo_max_bpm": 75, "repeticiones_por_dia": 5},
    ).json()
    assert (cambiada["tempo_min_bpm"], cambiada["tempo_max_bpm"]) == (65, 75)
    assert cambiada["repeticiones_por_dia"] == 5
    invertida = cliente.patch(
        f"/api/tareas/{tarea_id}", json={"tempo_min_bpm": 75, "tempo_max_bpm": 60}
    )
    assert invertida.status_code == 422

    cancelada = cliente.post(f"/api/tareas/{tarea_id}/cancelar").json()
    assert cancelada["estado"] == "Cancelada"
    assert (
        cliente.patch(f"/api/tareas/{tarea_id}", json={"repeticiones_por_dia": 2}).status_code
        == 409
    )
