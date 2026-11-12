from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.modules.catalog.models import ClaseError
from app.modules.pedagogy.models import Tarea, ValoracionTarea
from tests import escenario
from tests.conftest import como
from tests.test_pa_hu10 import tarea


def aspecto(db: Session) -> int:
    return db.scalars(select(ClaseError.id).order_by(ClaseError.id)).first()


def valorar(cliente: TestClient, tarea_id: int, **datos):
    return cliente.post(f"/api/tareas/{tarea_id}/valoracion", json=datos)


def test_pa_hu38_02_solo_el_asignado_valora_con_fecha_y_docente_por_repetir_exige_observacion(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    tarea_id = tarea(cliente, e)
    clase = aspecto(db)

    for ajeno in (e.docente_a2, e.docente_b, e.estudiante_a):
        r = valorar(como(cliente, ajeno), tarea_id, valor="lograda")
        assert r.status_code == 403, ajeno.username

    como(cliente, e.docente_a)
    assert valorar(cliente, tarea_id, valor="por_repetir").status_code == 422
    sin_aspecto = valorar(
        cliente, tarea_id, valor="por_repetir", observacion={"texto": "Más lento"}
    )
    assert sin_aspecto.status_code == 422
    vacia = valorar(
        cliente,
        tarea_id,
        valor="por_repetir",
        observacion={"clase_error_id": clase, "texto": " "},
    )
    assert vacia.status_code == 422
    assert db.scalars(select(ValoracionTarea)).all() == []

    r = valorar(
        cliente,
        tarea_id,
        valor="por_repetir",
        observacion={
            "clase_error_id": clase,
            "texto": "Repite a ♩ = 60 cuidando el pulso",
        },
        fecha_limite="2026-11-20",
    )
    assert r.status_code == 201, r.text
    t = r.json()
    assert t["estado"] == "En práctica"
    assert t["fecha_limite"] == "2026-11-20"
    assert t["valoracion"]["valor"] == "por_repetir"
    assert t["valoracion"]["docente_id"] == e.docente_a.id
    assert t["valoracion"]["creada_en"].startswith("2026-11-10")
    assert t["observaciones"][0]["texto"] == "Repite a ♩ = 60 cuidando el pulso"
    assert t["valoracion"]["observacion_id"] == t["observaciones"][0]["id"]

    lograda = valorar(cliente, tarea_id, valor="lograda")
    assert lograda.status_code == 201, lograda.text
    assert lograda.json()["estado"] == "Revisada"
    # Se guarda el historial; la tarea muestra la última.
    filas = db.scalars(select(ValoracionTarea.valor).order_by(ValoracionTarea.id)).all()
    assert filas == ["por_repetir", "lograda"]

    # El estudiante ve la valoración.
    propia = como(cliente, e.estudiante_a).get(f"/api/tareas/{tarea_id}").json()
    assert (propia["estado"], propia["valoracion"]["valor"]) == ("Revisada", "lograda")


def test_pu_pedagogy_10_revisada_prevalece_sobre_vencida_y_cancelada_sobre_todo(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    tarea_id = tarea(cliente, e)
    como(cliente, e.docente_a)
    assert valorar(cliente, tarea_id, valor="lograda").status_code == 201
    db.execute(update(Tarea).where(Tarea.id == tarea_id).values(fecha_limite=date(2026, 11, 1)))
    db.commit()
    assert cliente.get(f"/api/tareas/{tarea_id}").json()["estado"] == "Revisada"
    cliente.post(f"/api/tareas/{tarea_id}/cancelar")
    assert cliente.get(f"/api/tareas/{tarea_id}").json()["estado"] == "Cancelada"
    assert valorar(cliente, tarea_id, valor="lograda").status_code == 409


def test_pu_pedagogy_11_el_plazo_nuevo_solo_aplica_a_por_repetir_y_no_puede_ser_pasado(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    tarea_id = tarea(cliente, e)
    clase = aspecto(db)
    como(cliente, e.docente_a)
    obs = {"clase_error_id": clase, "texto": "Repite"}
    pasado = valorar(
        cliente,
        tarea_id,
        valor="por_repetir",
        observacion=obs,
        fecha_limite="2026-11-09",
    )
    assert pasado.status_code == 422
    con_plazo = valorar(cliente, tarea_id, valor="lograda", fecha_limite="2026-11-20")
    assert con_plazo.status_code == 422
