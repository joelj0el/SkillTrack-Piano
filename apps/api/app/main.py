from collections.abc import Sequence

from fastapi import APIRouter, Depends, FastAPI

from app import __version__
from app.core import salud
from app.core.csrf import ExigirCabeceraCsrf
from app.modules.identity import router as identity
from app.modules.identity.deps import exigir_sesion
from app.modules.institutions import router as institutions


def create_app(routers_privados: Sequence[APIRouter] = ()) -> FastAPI:
    app = FastAPI(title="SkillTrack-Piano API", version=__version__)
    app.add_middleware(ExigirCabeceraCsrf)

    publico = APIRouter(prefix="/api")
    publico.include_router(salud.router)
    publico.include_router(identity.publico)

    privado = APIRouter(prefix="/api", dependencies=[Depends(exigir_sesion)])
    for router in (identity.privado, institutions.router, *routers_privados):
        privado.include_router(router)

    app.include_router(publico)
    app.include_router(privado)
    return app


app = create_app()
