import copy

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from tests import escenario, fabricas
from tests.conftest import como
from tests.test_pa_hu08 import resultado

# Datos SINTÉTICOS: una referencia mínima del EJ-01 v1 (version_ejercicio_id = 1).
REFERENCIA = {
    "formato": 1,
    "version": 1,
    "version_ejercicio": "EJ-01@1",
    "n_docentes": 3,
    "metodo": {
        "unidad": "evento",
        "percentiles": {"inferior": 10, "superior": 90, "estado": "[PROVISIONAL]"},
        "factor_retencion": {"valor": 1, "estado": "[PROVISIONAL]"},
        "parametros_rasgos": {
            "desfase_manos.ms": {
                "diferencia_buscada": 50,
                "fuente": "PRM-11",
                "estado": "[PROVISIONAL]",
            }
        },
    },
    "bandas": [
        {
            "unidad": "e0",
            "rasgo": "desfase_manos.ms",
            "centro": 12.0,
            "inferior": 3.0,
            "superior": 30.0,
            "n_docentes": 3,
            "n_ejecuciones": 6,
        }
    ],
    "rasgos_descartados": [],
    "rasgos_sin_evaluar": [],
    "origen": {
        "campana": "A",
        "rol": "docente_ref",
        "origen_tomas": "real",
        "tomas": ["D01-EJ01-JUN-60-R1"],
        "version_nucleo": "0.9.0",
        "versiones_reprocesamiento": ["1.2.0"],
        "generada_en": "2027-02-01T12:00:00Z",
    },
}


def version(n: int) -> dict:
    ref = copy.deepcopy(REFERENCIA)
    ref["version"] = n
    return ref


def test_pa_hu22_01_publicar_una_version_existente_da_409_y_la_publicada_no_se_edita(
    cliente: TestClient, db: Session
):
    escenario.crear(db)
    superadmin = fabricas.usuario(db, "super", superadmin=True)
    como(cliente, superadmin)

    r = cliente.post("/api/catalogo/referencias", json=version(1))
    assert r.status_code == 201, r.text
    publicada = r.json()
    assert (publicada["version"], publicada["version_ejercicio_id"]) == (1, 1)

    otra = version(1)
    otra["bandas"][0]["superior"] = 99.0
    assert cliente.post("/api/catalogo/referencias", json=otra).status_code == 409

    ruta = f"/api/catalogo/referencias/{publicada['id']}"
    for metodo in ("PUT", "PATCH", "DELETE"):
        # No hay ruta para editar ni borrar una referencia publicada.
        assert cliente.request(metodo, ruta, json=otra).status_code in (404, 405)
    # Tampoco desde la base: un disparador rechaza UPDATE y DELETE.
    with pytest.raises(DBAPIError, match="inmutable"):
        db.execute(text("UPDATE app.referencia SET n_docentes = 9"))
    db.rollback()
    with pytest.raises(DBAPIError, match="inmutable"):
        db.execute(text("DELETE FROM app.referencia"))
    db.rollback()


def test_pa_hu22_01_solo_el_superadministrador_publica_403_para_los_demas_roles(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    investigador = fabricas.usuario(db, "investigador.a", rol="investigador", inst=e.inst_a)
    for usuario in (e.admin_a, e.docente_a, e.estudiante_a, investigador):
        r = como(cliente, usuario).post("/api/catalogo/referencias", json=version(1))
        assert r.status_code == 403, usuario.username
    assert db.scalar(text("SELECT count(*) FROM app.referencia")) == 0


def test_pu_catalog_10_el_cliente_lee_la_version_vigente_de_su_ejercicio(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    como(cliente, fabricas.usuario(db, "super", superadmin=True))
    ids = [cliente.post("/api/catalogo/referencias", json=version(n)).json()["id"] for n in (1, 2)]

    como(cliente, e.estudiante_a)
    vigente = cliente.get("/api/catalogo/referencias/vigente", params={"version_ejercicio_id": 1})
    assert vigente.status_code == 200, vigente.text
    assert vigente.json()["id"] == ids[1]
    assert vigente.json()["referencia"]["version"] == 2
    sin = cliente.get("/api/catalogo/referencias/vigente", params={"version_ejercicio_id": 2})
    assert sin.status_code == 404


def test_pu_catalog_11_un_ejercicio_desconocido_se_rechaza_con_422(
    cliente: TestClient, db: Session
):
    escenario.crear(db)
    como(cliente, fabricas.usuario(db, "super", superadmin=True))
    ref = version(1)
    ref["version_ejercicio"] = "EJ-99@1"
    r = cliente.post("/api/catalogo/referencias", json=ref)
    assert r.status_code == 422
    assert r.json()["detail"][0]["loc"] == ["body", "version_ejercicio"]


def test_pu_attempts_07_el_intento_registra_la_referencia_con_clave_foranea(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    como(cliente, fabricas.usuario(db, "super", superadmin=True))
    ref_id = cliente.post("/api/catalogo/referencias", json=version(1)).json()["id"]

    como(cliente, e.estudiante_a)
    ok = cliente.post("/api/intentos", json=resultado(referencia_id=ref_id))
    assert ok.status_code == 201, ok.text
    assert ok.json()["referencia_id"] == ref_id
    inexistente = cliente.post("/api/intentos", json=resultado(referencia_id=ref_id + 50))
    assert inexistente.status_code == 422
    # Una referencia de otro ejercicio no vale para este intento.
    otro = cliente.post(
        "/api/intentos", json=resultado(referencia_id=ref_id, version_ejercicio_id=2)
    )
    assert otro.status_code == 422
    with pytest.raises(DBAPIError):
        db.execute(text("UPDATE app.intento SET referencia_id = 9999"))
    db.rollback()
