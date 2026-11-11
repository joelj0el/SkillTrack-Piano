import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from tests import escenario, fabricas
from tests.conftest import como
from tests.test_pa_hu08 import resultado

# Datos SINTÉTICOS: una regla de ejemplo; su forma la fija el motor de reglas (HU-06).
REGLA = {"id": "R-B3", "clase": "ER-B", "indicador": "IND-B3", "si": "desfase_manos.ms > banda"}


def conjunto(version: int, **cambios) -> dict:
    return {"version": version, "version_taxonomia": "v0.1", "reglas": [REGLA], **cambios}


def test_pa_hu23_01_publicar_reglas_exige_la_version_de_la_taxonomia_y_es_inmutable(
    cliente: TestClient, db: Session
):
    escenario.crear(db)
    como(cliente, fabricas.usuario(db, "super", superadmin=True))

    sin_taxonomia = conjunto(1)
    del sin_taxonomia["version_taxonomia"]
    assert cliente.post("/api/catalogo/reglas", json=sin_taxonomia).status_code == 422
    desconocida = cliente.post("/api/catalogo/reglas", json=conjunto(1, version_taxonomia="v9"))
    assert desconocida.status_code == 422
    assert desconocida.json()["detail"][0]["loc"] == ["body", "version_taxonomia"]

    r = cliente.post("/api/catalogo/reglas", json=conjunto(1))
    assert r.status_code == 201, r.text
    assert (r.json()["version"], r.json()["version_taxonomia"]) == (1, "v0.1")
    assert cliente.post("/api/catalogo/reglas", json=conjunto(1, reglas=[])).status_code == 409
    with pytest.raises(DBAPIError, match="inmutable"):
        db.execute(text("UPDATE app.conjunto_reglas SET version_taxonomia = 'v0.2'"))
    db.rollback()


def test_pa_hu23_01_solo_el_superadministrador_publica_reglas_403_para_los_demas_roles(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    investigador = fabricas.usuario(db, "investigador.a", rol="investigador", inst=e.inst_a)
    for usuario in (e.admin_a, e.docente_a, e.estudiante_a, investigador):
        r = como(cliente, usuario).post("/api/catalogo/reglas", json=conjunto(1))
        assert r.status_code == 403, usuario.username
    assert db.scalar(text("SELECT count(*) FROM app.conjunto_reglas")) == 0


def test_pu_catalog_12_el_cliente_lee_las_reglas_vigentes(cliente: TestClient, db: Session):
    e = escenario.crear(db)
    como(cliente, e.estudiante_a)
    assert cliente.get("/api/catalogo/reglas/vigente").status_code == 404

    como(cliente, fabricas.usuario(db, "super", superadmin=True))
    ids = [cliente.post("/api/catalogo/reglas", json=conjunto(n)).json()["id"] for n in (1, 2)]
    vigente = como(cliente, e.estudiante_a).get("/api/catalogo/reglas/vigente")
    assert vigente.status_code == 200, vigente.text
    assert vigente.json()["id"] == ids[1]
    assert vigente.json()["conjunto"] == conjunto(2)


def test_pu_attempts_08_el_intento_registra_el_conjunto_de_reglas_con_clave_foranea(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    como(cliente, fabricas.usuario(db, "super", superadmin=True))
    reglas_id = cliente.post("/api/catalogo/reglas", json=conjunto(1)).json()["id"]

    como(cliente, e.estudiante_a)
    ok = cliente.post("/api/intentos", json=resultado(conjunto_reglas_id=reglas_id))
    assert ok.status_code == 201, ok.text
    assert ok.json()["conjunto_reglas_id"] == reglas_id
    malo = cliente.post("/api/intentos", json=resultado(conjunto_reglas_id=reglas_id + 50))
    assert malo.status_code == 422
    with pytest.raises(DBAPIError):
        db.execute(text("UPDATE app.intento SET conjunto_reglas_id = 9999"))
    db.rollback()
