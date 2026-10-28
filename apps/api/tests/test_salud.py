from fastapi.testclient import TestClient

from app.contracts_gen.salud import Salud
from app.main import create_app


def test_pu_api_01_health_responde_ok():
    respuesta = TestClient(create_app()).get("/api/health")

    assert respuesta.status_code == 200
    assert Salud.model_validate(respuesta.json()).estado == "ok"
