from collections.abc import Sequence

from fastapi import APIRouter, Depends, FastAPI

from app import __version__
from app.core import salud
from app.core.sesion import exigir_sesion


def create_app(routers_privados: Sequence[APIRouter] = ()) -> FastAPI:
    app = FastAPI(title="SkillTrack-Piano API", version=__version__)

    publico = APIRouter(prefix="/api")
    publico.include_router(salud.router)

    privado = APIRouter(prefix="/api", dependencies=[Depends(exigir_sesion)])
    for router in routers_privados:
        privado.include_router(router)

    app.include_router(publico)
    app.include_router(privado)
    return app


app = create_app()
