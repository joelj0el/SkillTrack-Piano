from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import text, update
from sqlalchemy.orm import Session

from app.modules.institutions.models import AsignacionDocente
from tests import escenario
from tests.conftest import como
from tests.test_pa_hu10 import medido


def guardar(cliente: TestClient, usuario, fecha: str, calificacion=None, indicadores=None, **c):
    cuerpo = medido(
        64,
        iniciado_en=fecha,
        calificacion=calificacion,
        indicadores_deficientes=indicadores,
        **c,
    )
    r = como(cliente, usuario).post("/api/intentos", json=cuerpo)
    assert r.status_code == 201, r.text


def test_pu_analytics_03_las_vistas_numeran_los_intentos_y_respetan_la_vigencia(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    guardar(cliente, e.estudiante_a, "2026-11-03T15:00:00Z", indicadores=["IND-D2"])
    guardar(cliente, e.estudiante_a, "2026-11-04T15:00:00Z", indicadores=[])
    filas = db.execute(
        text(
            "SELECT orden, clase, indicador FROM app.v_errores_recurrentes "
            "WHERE estudiante_id = :id ORDER BY orden"
        ),
        {"id": e.estudiante_a.id},
    ).all()
    assert [tuple(f) for f in filas] == [(1, None, None), (2, "ER-D", "IND-D2")]

    def grupo(hoy: str) -> list[int]:
        db.execute(text("SELECT set_config('app.hoy', :hoy, true)"), {"hoy": hoy})
        consulta = "SELECT estudiante_id FROM app.v_grupo_docente WHERE docente_id = :d"
        return list(db.scalars(text(consulta), {"d": e.docente_a.id}))

    assert grupo("2026-11-05") == [e.estudiante_a.id]
    db.execute(
        update(AsignacionDocente)
        .where(AsignacionDocente.docente_id == e.docente_a.id)
        .values(hasta=date(2026, 11, 9))
    )
    assert grupo("2026-11-08") == [e.estudiante_a.id]
    assert grupo("2026-11-09") == []
    # La asignación empieza el 2026-11-01: antes no hay grupo.
    assert grupo("2026-10-31") == []
    db.rollback()
