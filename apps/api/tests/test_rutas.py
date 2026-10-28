from fastapi import APIRouter, FastAPI
from fastapi.routing import APIRoute, RouteContext, iter_route_contexts
from fastapi.testclient import TestClient

from app.core.rutas_publicas import RUTAS_PUBLICAS
from app.core.sesion import exigir_sesion
from app.main import create_app


def _rutas_api(app: FastAPI) -> list[RouteContext]:
    # Rutas efectivas (prefijo y dependencias heredadas de los routers incluidos).
    return [
        contexto
        for contexto in iter_route_contexts(app.routes)
        if isinstance(contexto.original_route, APIRoute)
    ]


def _exige_sesion(ruta: RouteContext) -> bool:
    pendientes = [ruta.dependant]
    while pendientes:
        dependencia = pendientes.pop()
        if dependencia.call is exigir_sesion:
            return True
        pendientes.extend(dependencia.dependencies)
    return False


def rutas_sin_sesion(app: FastAPI) -> list[str]:
    return [
        ruta.path
        for ruta in _rutas_api(app)
        if ruta.path not in RUTAS_PUBLICAS and not _exige_sesion(ruta)
    ]


def test_pu_api_03_las_rutas_publicas_existen():
    rutas = {ruta.path for ruta in _rutas_api(create_app())}

    assert RUTAS_PUBLICAS <= rutas


def test_pu_api_04_toda_ruta_no_publica_exige_sesion():
    assert rutas_sin_sesion(create_app()) == []


def test_pu_api_05_se_detecta_una_ruta_privada_sin_sesion():
    app = create_app()
    router = APIRouter()
    router.add_api_route("/api/sonda", lambda: {})
    app.include_router(router)

    assert rutas_sin_sesion(app) == ["/api/sonda"]


def test_pu_api_06_una_ruta_privada_sin_sesion_responde_401():
    app = create_app(routers_privados=[_router_sonda()])

    assert TestClient(app).get("/api/sonda").status_code == 401


def _router_sonda() -> APIRouter:
    router = APIRouter()
    router.add_api_route("/sonda", lambda: {})
    return router
