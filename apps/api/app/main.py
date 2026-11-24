from collections.abc import Sequence

from fastapi import APIRouter, Depends, FastAPI

from app import __version__
from app.core import salud
from app.core.csrf import ExigirCabeceraCsrf
from app.core.limite_ip import LimitePorIp
from app.core.limites import LimitarCuerpo
from app.modules.analytics import router as analytics
from app.modules.attempts import router as attempts
from app.modules.catalog import router as catalog
from app.modules.identity import router as identity
from app.modules.identity.deps import exigir_sesion
from app.modules.institutions import router as institutions
from app.modules.pedagogy import router as pedagogy
from app.modules.plans import router as plans
from app.modules.plans.deps import exigir_cuenta_al_dia


def create_app(routers_privados: Sequence[APIRouter] = ()) -> FastAPI:
    app = FastAPI(title="SkillTrack-Piano API", version=__version__)
    app.add_middleware(ExigirCabeceraCsrf)
    app.add_middleware(LimitarCuerpo)
    app.state.limite_ip = LimitePorIp()

    publico = APIRouter(prefix="/api")
    publico.include_router(salud.router)
    publico.include_router(identity.publico)
    publico.include_router(plans.publico)

    privado = APIRouter(
        prefix="/api", dependencies=[Depends(exigir_sesion), Depends(exigir_cuenta_al_dia)]
    )
    modulos = (
        identity.privado,
        institutions.router,
        catalog.router,
        pedagogy.router,
        attempts.router,
        analytics.router,
        plans.router,
    )
    for router in (*modulos, *routers_privados):
        privado.include_router(router)

    app.include_router(publico)
    app.include_router(privado)
    return app


app = create_app()
