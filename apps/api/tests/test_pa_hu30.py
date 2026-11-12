from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.modules.audit.models import AuditoriaAcceso
from app.modules.institutions.models import AsignacionDocente
from tests import escenario
from tests.conftest import como
from tests.test_pa_hu10 import medido, tarea

CALIFICACION = [
    {"clase": "ER-A", "nivel": "logrado", "pct": 95},
    {"clase": "ER-B", "nivel": "por-mejorar", "pct": 60},
]


def acciones(db: Session, recurso_id: int) -> list[str]:
    consulta = select(AuditoriaAcceso.accion).where(
        AuditoriaAcceso.recurso == "tarea", AuditoriaAcceso.recurso_id == recurso_id
    )
    return sorted(db.scalars(consulta))


def test_pa_hu30_01_solo_el_docente_asignado_ve_los_intentos_y_cada_lectura_se_audita(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    tarea_id = tarea(cliente, e)
    como(cliente, e.estudiante_a)
    primero = medido(
        64,
        tarea_id=tarea_id,
        iniciado_en="2026-11-10T15:00:00Z",
        calificacion=CALIFICACION,
        indicadores_deficientes=["IND-B2"],
    )
    segundo = medido(None, tarea_id=tarea_id, estado="no_evaluable", motivo_no_evaluable="x")
    for cuerpo in (primero, segundo):
        assert cliente.post("/api/intentos", json=cuerpo).status_code == 201

    r = como(cliente, e.docente_a).get(f"/api/tareas/{tarea_id}/intentos")
    assert r.status_code == 200, r.text
    intentos = r.json()
    # Del más reciente al más antiguo, con lo que el docente necesita para valorar.
    assert [i["estado"] for i in intentos] == ["no_evaluable", "evaluado"]
    anterior = intentos[1]
    assert anterior["iniciado_en"].startswith("2026-11-10T15:00:00")
    assert (anterior["tempo_elegido_bpm"], anterior["tempo_medido_bpm"]) == (60, 64)
    assert anterior["modo_metronomo"] == "sin"
    assert anterior["calificacion"] == CALIFICACION
    assert anterior["indicadores_deficientes"] == ["IND-B2"]
    assert intentos[0]["indicadores_deficientes"] is None
    assert acciones(db, tarea_id) == ["leer_intentos"]

    for ajeno in (e.docente_a2, e.docente_b, e.estudiante_b):
        r = como(cliente, ajeno).get(f"/api/tareas/{tarea_id}/intentos")
        assert r.status_code == 403, ajeno.username
    assert acciones(db, tarea_id) == ["acceso_denegado"] * 3 + ["leer_intentos"]


def test_pu_attempts_10_sin_asignacion_vigente_el_docente_ya_no_ve_los_intentos(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    tarea_id = tarea(cliente, e)
    db.execute(
        update(AsignacionDocente)
        .where(AsignacionDocente.docente_id == e.docente_a.id)
        .values(hasta=date(2026, 11, 9))
    )
    db.commit()
    assert como(cliente, e.docente_a).get(f"/api/tareas/{tarea_id}/intentos").status_code == 403
