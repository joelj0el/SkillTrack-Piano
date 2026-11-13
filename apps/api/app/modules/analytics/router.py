from typing import Annotated

from fastapi import APIRouter, Query

from app.contracts_gen.mi_grupo import MiGrupo
from app.contracts_gen.mi_progreso import MiProgreso
from app.core.reloj import hoy_local
from app.modules.analytics import service
from app.modules.identity.deps import UsuarioEnSesion
from app.modules.institutions import service as instituciones
from app.modules.institutions.deps import PROHIBIDO, Ahora, Db

router = APIRouter(prefix="/tableros", tags=["analytics"])

ULTIMOS_POR_DEFECTO = 10
ULTIMOS_MAX = 50


@router.get("/mi-progreso", response_model=MiProgreso)
def mi_progreso(usuario: UsuarioEnSesion, db: Db) -> MiProgreso:
    """P-44: solo los datos del propio estudiante."""
    if not instituciones.instituciones_de(db, usuario.id, "estudiante"):
        raise PROHIBIDO
    return service.progreso(db, usuario.id)


@router.get("/mi-grupo", response_model=MiGrupo)
def mi_grupo(
    usuario: UsuarioEnSesion,
    db: Db,
    instante: Ahora,
    ultimos: Annotated[int, Query(ge=1, le=ULTIMOS_MAX)] = ULTIMOS_POR_DEFECTO,
) -> MiGrupo:
    """P-26: solo los estudiantes con asignación vigente del docente."""
    if not instituciones.instituciones_de(db, usuario.id, "docente"):
        raise PROHIBIDO
    return service.grupo(db, usuario.id, hoy_local(instante), ultimos)
