from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalog.models import ClaseError, Ejercicio, VersionEjercicio


def test_pu_catalog_01_el_repertorio_v0_tiene_cuatro_escalas_en_orden(db: Session):
    ejercicios = db.scalars(select(Ejercicio).order_by(Ejercicio.orden)).all()

    assert [e.codigo for e in ejercicios] == ["EJ-01", "EJ-02", "EJ-03", "EJ-04"]
    assert [e.tonalidad for e in ejercicios] == ["Do mayor", "Fa mayor", "Si♭ mayor", "Mi♭ mayor"]


def test_pu_catalog_02_sin_transcripcion_no_hay_eventos_ni_partitura(db: Session):
    for version in db.scalars(select(VersionEjercicio)):
        assert version.eventos_esperados == []
        assert version.partitura_svg is None
        assert version.nota_min_midi is None


def test_pu_catalog_03_la_taxonomia_v01_tiene_seis_clases(db: Session):
    codigos = db.scalars(select(ClaseError.codigo).order_by(ClaseError.codigo)).all()

    assert codigos == ["ER-A", "ER-B", "ER-C", "ER-D", "ER-E", "ER-F"]
