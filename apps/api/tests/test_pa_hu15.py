from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.modules.institutions.models import AsignacionDocente
from tests import escenario
from tests.conftest import como
from tests.test_vistas_tableros import guardar


def cal(**pct) -> list[dict]:
    return [
        {
            "clase": clase.replace("_", "-"),
            "nivel": "en-desarrollo" if p else "no-evaluado",
            "pct": p,
        }
        for clase, p in pct.items()
    ]


def test_pa_hu15_01_mi_progreso_da_el_pct_promedio_por_variable_y_semana_del_propio_estudiante(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    # Semana del lunes 2026-11-02 y semana del lunes 2026-11-09 (hora de La Paz).
    guardar(cliente, e.estudiante_a, "2026-11-03T15:00:00Z", cal(ER_A=80, ER_B=None))
    guardar(cliente, e.estudiante_a, "2026-11-04T15:00:00Z", cal(ER_A=90, ER_B=50))
    guardar(cliente, e.estudiante_a, "2026-11-10T15:00:00Z", cal(ER_A=70))
    # Lunes 03:30 UTC es todavía domingo 23:30 en La Paz: cuenta para la semana del 2026-11-02.
    guardar(cliente, e.estudiante_a, "2026-11-09T03:30:00Z", cal(ER_A=100))
    guardar(cliente, e.estudiante_a, "2026-11-10T16:00:00Z", None, estado="no_evaluable")
    guardar(cliente, e.estudiante_a2, "2026-11-10T15:00:00Z", cal(ER_A=10))

    r = como(cliente, e.estudiante_a).get("/api/tableros/mi-progreso")
    assert r.status_code == 200, r.text
    assert r.json()["semanas"] == [
        {"semana": "2026-11-02", "clase": "ER-A", "intentos": 3, "pct_promedio": 90.0},
        {"semana": "2026-11-02", "clase": "ER-B", "intentos": 1, "pct_promedio": 50.0},
        {"semana": "2026-11-09", "clase": "ER-A", "intentos": 1, "pct_promedio": 70.0},
    ]
    # Ningún campo de puntaje global, posición ni comparación con otros.
    assert set(r.json()) == {"semanas"}


def test_pu_analytics_01_mi_progreso_es_solo_del_estudiante_docente_ajeno_403(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    for docente in (e.docente_a, e.docente_a2, e.docente_b):
        assert como(cliente, docente).get("/api/tableros/mi-progreso").status_code == 403
    r = como(cliente, e.estudiante_b).get("/api/tableros/mi-progreso")
    assert r.json() == {"semanas": []}


def test_pa_hu15_02_mi_grupo_da_los_errores_recurrentes_por_clase_y_estudiante_sin_ranking(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    guardar(cliente, e.estudiante_a, "2026-11-03T15:00:00Z", indicadores=["IND-C1"])
    guardar(
        cliente,
        e.estudiante_a,
        "2026-11-04T15:00:00Z",
        indicadores=["IND-B1", "IND-B2"],
    )
    guardar(cliente, e.estudiante_a, "2026-11-05T15:00:00Z", indicadores=["IND-B2"])
    guardar(cliente, e.estudiante_a, "2026-11-06T15:00:00Z", indicadores=[])
    # Sin reglas (indicadores nulos) o no evaluable: no entra en los intentos considerados.
    guardar(cliente, e.estudiante_a, "2026-11-07T15:00:00Z")
    guardar(cliente, e.estudiante_a, "2026-11-07T16:00:00Z", estado="no_evaluable")
    # Otro estudiante de la misma institución, sin asignación con docente.a.
    guardar(cliente, e.estudiante_a2, "2026-11-05T15:00:00Z", indicadores=["IND-A1"])

    r = como(cliente, e.docente_a).get("/api/tableros/mi-grupo")
    assert r.status_code == 200, r.text
    assert r.json() == {
        "ultimos": 10,
        "estudiantes": [
            {
                "estudiante_id": e.estudiante_a.id,
                "nombre_visible": e.estudiante_a.nombre_visible,
                "intentos_considerados": 4,
                "errores": [
                    {
                        "clase": "ER-B",
                        "intentos_con_error": 2,
                        "indicadores": ["IND-B1", "IND-B2"],
                    },
                    {
                        "clase": "ER-C",
                        "intentos_con_error": 1,
                        "indicadores": ["IND-C1"],
                    },
                ],
            }
        ],
    }
    # Últimos N: con N = 2 solo cuentan los dos intentos evaluados más recientes.
    r = como(cliente, e.docente_a).get("/api/tableros/mi-grupo", params={"ultimos": 2})
    (estudiante,) = r.json()["estudiantes"]
    assert estudiante["intentos_considerados"] == 2
    assert estudiante["errores"] == [
        {"clase": "ER-B", "intentos_con_error": 1, "indicadores": ["IND-B2"]}
    ]


def test_pu_analytics_02_mi_grupo_solo_con_asignacion_vigente_y_estudiante_403(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    guardar(cliente, e.estudiante_a, "2026-11-05T15:00:00Z", indicadores=["IND-A1"])
    for ajeno in (e.docente_a2, e.docente_b):
        r = como(cliente, ajeno).get("/api/tableros/mi-grupo")
        assert r.status_code == 200
        assert r.json()["estudiantes"] == [], ajeno.username
    for estudiante in (e.estudiante_a, e.estudiante_b):
        assert como(cliente, estudiante).get("/api/tableros/mi-grupo").status_code == 403
    for fuera in (0, 51):
        r = como(cliente, e.docente_a).get("/api/tableros/mi-grupo", params={"ultimos": fuera})
        assert r.status_code == 422
    db.execute(
        update(AsignacionDocente)
        .where(AsignacionDocente.docente_id == e.docente_a.id)
        .values(hasta=date(2026, 11, 9))
    )
    db.commit()
    assert como(cliente, e.docente_a).get("/api/tableros/mi-grupo").json()["estudiantes"] == []
