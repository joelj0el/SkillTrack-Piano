from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests import escenario
from tests.conftest import como


def test_pa_hu02_01_catalogo_con_el_repertorio_v0_en_orden_y_401_sin_sesion(
    cliente: TestClient, db: Session
):
    assert cliente.get("/api/catalogo/ejercicios").status_code == 401

    e = escenario.crear(db)
    ejercicios = como(cliente, e.estudiante_a).get("/api/catalogo/ejercicios").json()

    assert [x["codigo"] for x in ejercicios] == ["EJ-01", "EJ-02", "EJ-03", "EJ-04"]
    assert [x["tonalidad"] for x in ejercicios] == [
        "Do mayor",
        "Fa mayor",
        "Si♭ mayor",
        "Mi♭ mayor",
    ]
    for x in ejercicios:
        assert x["compas"] == "2/4" and x["figura"] == "semicorchea"
        assert x["variantes_manos"] == ["MI", "MD", "juntas"]
        vigente = x["version_vigente"]
        assert vigente["version"] == 1
        assert (vigente["tempo_min_permitido_bpm"], vigente["tempo_max_permitido_bpm"]) == (60, 75)


def test_pu_catalog_04_detalle_por_codigo_y_taxonomia(cliente: TestClient, db: Session):
    e = escenario.crear(db)
    como(cliente, e.docente_a)

    detalle = cliente.get("/api/catalogo/ejercicios/EJ-03").json()
    assert detalle["nombre"] == "Escala de Si♭ mayor"
    assert detalle["version_vigente"]["transcripcion"] == "pendiente"
    assert cliente.get("/api/catalogo/ejercicios/EJ-99").status_code == 404
    clases = cliente.get("/api/catalogo/taxonomia").json()
    assert [c["codigo"] for c in clases] == ["ER-A", "ER-B", "ER-C", "ER-D", "ER-E", "ER-F"]
