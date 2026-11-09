from datetime import datetime
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.db import obtener_db
from app.core.reloj import ahora
from app.modules.identity import service
from app.modules.identity.models import Usuario

COOKIE_SESION = "sesion"
# Con clave temporal solo se puede consultar la sesión, cambiar la clave o salir (PA-HU01-02).
RUTAS_CON_CLAVE_TEMPORAL = frozenset(
    {"/api/auth/me", "/api/auth/cambiar-clave", "/api/auth/logout"}
)


def exigir_sesion(
    request: Request,
    db: Annotated[Session, Depends(obtener_db)],
    instante: Annotated[datetime, Depends(ahora)],
    sesion: Annotated[str | None, Cookie(alias=COOKIE_SESION)] = None,
) -> Usuario:
    usuario = service.usuario_de_sesion(db, sesion, instante) if sesion else None
    if usuario is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Se requiere sesión")
    if usuario.clave_temporal and request.url.path not in RUTAS_CON_CLAVE_TEMPORAL:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Debes cambiar tu contraseña temporal")
    return usuario


UsuarioEnSesion = Annotated[Usuario, Depends(exigir_sesion)]
