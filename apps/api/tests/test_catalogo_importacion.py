import json
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.modules.catalog.importar import cargar_partitura, exportar, sanear_svg
from app.modules.catalog.models import VersionEjercicio
from app.modules.catalog.musicxml import ErrorPartitura, contar_notas, importar_musicxml
from tests import escenario
from tests.conftest import como

FIXTURES = Path(__file__).resolve().parents[3] / "tools" / "catalogo" / "fixtures"
MUSICXML = (FIXTURES / "PRUEBA-escala-do.musicxml").read_text(encoding="utf-8")
SVG = (FIXTURES / "PRUEBA-escala-do.svg").read_text(encoding="utf-8")


@pytest.fixture
def versiones_limpias(db: Session) -> Iterator[None]:
    """Las versiones importadas se borran: el catálogo es una tabla de referencia compartida."""
    yield
    db.rollback()
    db.execute(delete(VersionEjercicio).where(VersionEjercicio.version > 1))
    db.commit()


def test_pa_hu02_02_la_version_vigente_tiene_un_evento_por_nota_del_musicxml(
    cliente: TestClient, db: Session, versiones_limpias: None
):
    assert cargar_partitura(db, "EJ-01", MUSICXML, SVG) == ("nueva", 2)

    e = escenario.crear(db)
    vigente = como(cliente, e.estudiante_a).get("/api/catalogo/ejercicios/EJ-01").json()
    version = vigente["version_vigente"]
    eventos = version["eventos_esperados"]

    assert version["version"] == 2
    assert len(eventos) == contar_notas(MUSICXML) == 58
    assert {"mano", "dedo", "clase_altura", "midi", "tiempo_beats"} <= set(eventos[0])
    assert sum(1 for x in eventos if x["mano"] == "MD") == 29
    # La partitura de prueba empieza a manos juntas con Do3 (dedo 5) y Do4 (dedo 1).
    primeros = sorted((x["mano"], x["midi"], x["dedo"]) for x in eventos if x["tiempo_beats"] == 0)
    assert primeros == [("MD", 60, 1), ("MI", 48, 5)]
    assert eventos[-1]["tiempo_beats"] == 7.0
    assert (version["nota_min_midi"], version["nota_max_midi"]) == (48, 84)
    assert version["transcripcion"] == "importada"
    assert "<style" not in version["partitura_svg"]


def test_pu_catalog_05_la_importacion_falla_si_los_eventos_no_coinciden_con_las_notas():
    def pierde_una(raiz):
        from app.modules.catalog.musicxml import extraer_eventos

        return extraer_eventos(raiz)[:-1]

    with pytest.raises(ErrorPartitura, match="57 eventos para 58 notas"):
        importar_musicxml(MUSICXML, extraer=pierde_una)


def test_pu_catalog_06_sin_digitacion_o_sin_pentagramas_no_se_adivina():
    sin_dedo = MUSICXML.replace("<fingering>3</fingering>", "", 1)
    with pytest.raises(ErrorPartitura, match="sin digitación.*compás 1"):
        importar_musicxml(sin_dedo)

    un_pentagrama = MUSICXML.replace("<staves>2</staves>", "").replace("<staff>2</staff>", "")
    un_pentagrama = un_pentagrama.replace("<staff>1</staff>", "")
    with pytest.raises(ErrorPartitura, match="mano"):
        importar_musicxml(un_pentagrama)


def test_pu_catalog_07_volver_a_cargar_lo_mismo_no_crea_otra_version(
    db: Session, versiones_limpias: None
):
    assert cargar_partitura(db, "EJ-02", MUSICXML, SVG) == ("nueva", 2)
    assert cargar_partitura(db, "EJ-02", MUSICXML, SVG) == ("sin-cambios", 2)
    otra = SVG.replace("<desc>", "<desc>otra ", 1)
    assert cargar_partitura(db, "EJ-02", MUSICXML, otra) == ("nueva", 3)
    with pytest.raises(ErrorPartitura, match="EJ-99"):
        cargar_partitura(db, "EJ-99", MUSICXML, SVG)


def test_pu_catalog_08_el_svg_se_limpia_de_estilos_scripts_y_enlaces_externos():
    sucio = (
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"'
        ' onload="x()"><style>a{}</style><script>x()</script><foreignObject/>'
        '<use xlink:href="#glifo"/><a href="https://ejemplo.org"><path d="M0 0"/></a></svg>'
    )
    limpio = sanear_svg(sucio)
    for prohibido in ("onload", "<style", "<script", "foreignObject", "ejemplo.org"):
        assert prohibido not in limpio
    assert "#glifo" in limpio and "M0 0" in limpio


def test_pu_catalog_09_el_dato_de_prueba_de_la_e2e_es_la_importacion_de_la_partitura_de_prueba():
    guardado = json.loads((FIXTURES / "PRUEBA-escala-do.json").read_text(encoding="utf-8"))
    assert guardado == exportar(MUSICXML, SVG)
