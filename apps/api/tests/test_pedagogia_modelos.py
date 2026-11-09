from datetime import UTC, date, datetime

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.pedagogy.models import Tarea
from app.modules.pedagogy.service import estado
from tests import escenario

HOY = date(2026, 11, 10)


def _tarea(e, **cambios) -> Tarea:
    datos = dict(
        institucion_id=e.inst_a.id,
        docente_id=e.docente_a.id,
        estudiante_id=e.estudiante_a.id,
        ejercicio_id=1,
        manos="juntas",
        tempo_min_bpm=60,
        tempo_max_bpm=70,
        repeticiones_por_dia=3,
        fecha_limite=date(2026, 11, 17),
    )
    datos.update(cambios)
    return Tarea(**datos)


def test_pu_pedagogy_01_el_estado_se_calcula_y_no_se_guarda(db: Session):
    e = escenario.crear(db)
    tarea = _tarea(e)

    assert estado(tarea, HOY) == "Asignada"
    assert estado(tarea, date(2026, 11, 18)) == "Vencida"
    tarea.cancelada_en = datetime(2026, 11, 11, tzinfo=UTC)
    assert estado(tarea, HOY) == "Cancelada"
    assert not hasattr(Tarea, "estado")


@pytest.mark.parametrize(
    "cambio",
    [
        {"tempo_min_bpm": 70, "tempo_max_bpm": 60},
        {"tempo_max_bpm": 80},
        {"repeticiones_por_dia": 0},
        {"manos": "ambas"},
    ],
)
def test_pu_pedagogy_02_la_base_rechaza_tareas_fuera_de_rango(db: Session, cambio):
    e = escenario.crear(db)
    db.add(_tarea(e, **cambio))

    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
