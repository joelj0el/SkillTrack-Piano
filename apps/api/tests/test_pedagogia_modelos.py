from datetime import UTC, date, datetime

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.pedagogy.models import Observacion, Tarea, ValoracionTarea
from app.modules.pedagogy.service import estados
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


def test_pu_pedagogy_01_el_estado_se_calcula_en_v_estado_tarea_y_no_se_guarda(db: Session):
    e = escenario.crear(db)
    tarea = _tarea(e)
    db.add(tarea)
    db.commit()

    assert estados(db, [tarea.id], HOY) == {tarea.id: "Asignada"}
    assert estados(db, [tarea.id], date(2026, 11, 18)) == {tarea.id: "Vencida"}
    tarea.cancelada_en = datetime(2026, 11, 11, tzinfo=UTC)
    db.commit()
    assert estados(db, [tarea.id], HOY) == {tarea.id: "Cancelada"}
    assert not hasattr(Tarea, "estado")
    columnas = db.execute(
        text(
            "SELECT column_name FROM information_schema.columns"
            " WHERE table_schema = 'app' AND table_name = 'tarea'"
        )
    ).scalars()
    assert "estado" not in set(columnas)


def test_pu_pedagogy_12_la_ultima_valoracion_decide_revisada_o_en_practica(db: Session):
    e = escenario.crear(db)
    tarea = _tarea(e)
    db.add(tarea)
    db.commit()

    def valorar(valor: str, dia: int) -> None:
        obs = None
        if valor == "por_repetir":
            obs = Observacion(
                docente_id=e.docente_a.id,
                estudiante_id=e.estudiante_a.id,
                tarea_id=tarea.id,
                texto="Repite",
            )
            db.add(obs)
            db.flush()
        db.add(
            ValoracionTarea(
                tarea_id=tarea.id,
                docente_id=e.docente_a.id,
                valor=valor,
                observacion_id=obs.id if obs else None,
                creada_en=datetime(2026, 11, dia, tzinfo=UTC),
            )
        )
        db.commit()

    valorar("lograda", 10)
    # Revisada prevalece sobre el plazo vencido.
    assert estados(db, [tarea.id], date(2026, 11, 30)) == {tarea.id: "Revisada"}
    valorar("por_repetir", 11)
    assert estados(db, [tarea.id], HOY) == {tarea.id: "En práctica"}
    assert estados(db, [tarea.id], date(2026, 11, 30)) == {tarea.id: "Vencida"}
    # Sin fecha inyectada, la vista usa el día de La Paz.
    sin_fecha = db.execute(
        text("SELECT estado FROM app.v_estado_tarea WHERE tarea_id = :t"), {"t": tarea.id}
    ).scalar_one()
    assert sin_fecha in {"En práctica", "Vencida"}


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
