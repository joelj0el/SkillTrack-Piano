import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.csrf import CABECERA_CSRF
from app.core.reloj import ahora
from app.main import create_app
from app.modules.audit.models import AuditoriaAcceso
from app.modules.institutions.deps import AdminDeInstitucion, EstudianteAccesible
from tests import escenario
from tests.conftest import Reloj, como

sonda = APIRouter()


@sonda.get("/sonda/instituciones/{institucion_id}")
def _admin(institucion_id: AdminDeInstitucion) -> dict:
    return {"ok": institucion_id}


@sonda.get("/sonda/estudiantes/{estudiante_id}")
def _estudiante(estudiante_id: EstudianteAccesible) -> dict:
    return {"ok": estudiante_id}


@pytest.fixture
def cliente_sonda(db: Session, reloj: Reloj):
    app = create_app(routers_privados=[sonda])
    app.dependency_overrides[ahora] = lambda: reloj.instante
    with TestClient(app, base_url="https://testserver", headers={CABECERA_CSRF: "1"}) as c:
        yield c


def test_pu_institutions_03_solo_el_admin_de_la_institucion_la_administra(cliente_sonda, db):
    e = escenario.crear(db)
    ruta = f"/api/sonda/instituciones/{e.inst_a.id}"

    assert como(cliente_sonda, e.admin_a).get(ruta).status_code == 200
    for ajeno in (e.admin_b, e.docente_a, e.estudiante_a, e.docente_b):
        assert como(cliente_sonda, ajeno).get(ruta).status_code == 403, ajeno.username


def test_pu_institutions_04_docente_ajeno_recibe_403_y_queda_auditado(cliente_sonda, db):
    e = escenario.crear(db)
    ruta = f"/api/sonda/estudiantes/{e.estudiante_a.id}"

    assert como(cliente_sonda, e.docente_a).get(ruta).status_code == 200
    assert como(cliente_sonda, e.admin_a).get(ruta).status_code == 200
    for ajeno in e.ajenos_a_estudiante_a():
        assert como(cliente_sonda, ajeno).get(ruta).status_code == 403, ajeno.username

    denegados = db.scalars(
        select(AuditoriaAcceso).where(AuditoriaAcceso.accion == "acceso_denegado")
    ).all()
    assert len(denegados) == len(e.ajenos_a_estudiante_a())
