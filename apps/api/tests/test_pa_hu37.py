from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.modules.pedagogy.models import Tarea
from tests import escenario
from tests.conftest import Reloj, como
from tests.test_pa_hu10 import medido, tarea


def avance(cliente: TestClient, tarea_id: int) -> dict:
    r = cliente.get(f"/api/tareas/{tarea_id}/avance")
    assert r.status_code == 200, r.text
    return r.json()


def test_pa_hu37_02_solo_cuentan_los_validos_y_cada_intento_dice_por_que(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    tarea_id = tarea(cliente, e)
    como(cliente, e.estudiante_a)
    cuerpos = [
        medido(64, tarea_id=tarea_id),
        medido(64, tarea_id=tarea_id, estado="no_evaluable", motivo_no_evaluable="Sin manos"),
        medido(45, tarea_id=tarea_id, tempo_elegido_bpm=45),
        medido(55, tarea_id=tarea_id),
        medido(None, tarea_id=tarea_id),
    ]
    for cuerpo in cuerpos:
        assert cliente.post("/api/intentos", json=cuerpo).status_code == 201

    propio = avance(cliente, tarea_id)
    assert (propio["validas_hoy"], propio["meta_por_dia"]) == (1, 3)
    motivos = sorted(i["motivo_no_cuenta"] or "" for i in propio["intentos"])
    assert motivos == [
        "",
        "Intento no evaluable",
        "Práctica lenta",
        "Sin tempo medido",
        "Tocaste a ♩≈55; tu tarea pide 60–70",
    ]
    # El docente ve la misma lista, con la práctica lenta incluida.
    del_docente = avance(como(cliente, e.docente_a), tarea_id)
    assert "Práctica lenta" in [i["motivo_no_cuenta"] for i in del_docente["intentos"]]
    assert del_docente["dias"] == [{"fecha": "2026-11-10", "validas": 1, "meta": 3}]


def test_pa_hu37_04_estado_asignada_en_practica_vencida_y_403_al_docente_ajeno(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    tarea_id = tarea(cliente, e)
    estado = lambda: como(cliente, e.estudiante_a).get(f"/api/tareas/{tarea_id}").json()["estado"]  # noqa: E731
    assert estado() == "Asignada"
    cliente.post("/api/intentos", json=medido(55, tarea_id=tarea_id))
    assert estado() == "Asignada"  # Un intento que no cuenta no la pone en práctica.
    cliente.post("/api/intentos", json=medido(62, tarea_id=tarea_id))
    assert estado() == "En práctica"
    db.execute(update(Tarea).where(Tarea.id == tarea_id).values(fecha_limite=date(2026, 11, 1)))
    db.commit()
    assert estado() == "Vencida"

    for ajeno in (e.docente_a2, e.docente_b):
        r = como(cliente, ajeno).get(f"/api/tareas/{tarea_id}/avance")
        assert r.status_code == 403, ajeno.username
    assert como(cliente, e.estudiante_b).get(f"/api/tareas/{tarea_id}/avance").status_code == 404


def test_pu_pedagogy_09_el_dia_se_cuenta_en_la_zona_de_la_paz_desde_la_asignacion(
    cliente: TestClient, db: Session, reloj: Reloj
):
    e = escenario.crear(db)
    tarea_id = tarea(cliente, e)
    como(cliente, e.estudiante_a)
    # 03:30 UTC del 11-nov son las 23:30 del 10-nov en La Paz: cuenta para el 10.
    tarde = medido(64, tarea_id=tarea_id, iniciado_en="2026-11-11T03:30:00Z")
    cliente.post("/api/intentos", json=tarde)
    reloj.avanzar(days=2)
    dias = avance(cliente, tarea_id)["dias"]
    hoy = date(2026, 11, 12)
    assert [d["fecha"] for d in dias] == [str(hoy - timedelta(days=n)) for n in range(2, -1, -1)]
    assert [d["validas"] for d in dias] == [1, 0, 0]
