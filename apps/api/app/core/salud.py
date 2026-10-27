from fastapi import APIRouter

from app import __version__
from app.contracts_gen.salud import Salud

router = APIRouter()


@router.get("/health", response_model=Salud)
def salud() -> Salud:
    return Salud(estado="ok", version=__version__)
