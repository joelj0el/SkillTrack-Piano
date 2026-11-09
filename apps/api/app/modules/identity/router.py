from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.contracts_gen.cambio_clave import CambioClave
from app.contracts_gen.inicio_sesion import InicioSesion
from app.contracts_gen.usuario_actual import Membresia, UsuarioActual
from app.core.db import obtener_db
from app.core.reloj import ahora
from app.modules.identity import service
from app.modules.identity.deps import COOKIE_SESION, UsuarioEnSesion
from app.modules.identity.models import Usuario
from app.modules.institutions.service import membresias_de

MENSAJE_CREDENCIALES = "Usuario o contraseña incorrectos"

publico = APIRouter(prefix="/auth", tags=["identity"])
privado = APIRouter(prefix="/auth", tags=["identity"])

Db = Annotated[Session, Depends(obtener_db)]
Ahora = Annotated[datetime, Depends(ahora)]


def usuario_actual(db: Session, usuario: Usuario) -> UsuarioActual:
    return UsuarioActual(
        id=usuario.id,
        usuario=usuario.username,
        nombre_visible=usuario.nombre_visible,
        superadmin=usuario.superadmin,
        clave_temporal=usuario.clave_temporal,
        membresias=[
            Membresia(institucion_id=m.institucion_id, rol=m.rol)
            for m in membresias_de(db, usuario.id)
        ],
    )


@publico.post("/login", response_model=UsuarioActual)
def login(datos: InicioSesion, respuesta: Response, db: Db, instante: Ahora) -> UsuarioActual:
    try:
        usuario = service.autenticar(db, datos.usuario, datos.clave, instante)
    except service.UsuarioBloqueado:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Demasiados intentos. Vuelve a intentarlo en 15 minutos.",
        ) from None
    except service.CredencialesInvalidas:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, MENSAJE_CREDENCIALES) from None
    token = service.crear_sesion(db, usuario, instante)
    respuesta.set_cookie(
        COOKIE_SESION,
        token,
        max_age=int(service.INACTIVIDAD_MAXIMA.total_seconds()),
        path="/api",
        httponly=True,
        secure=True,
        samesite="lax",
    )
    return usuario_actual(db, usuario)


@privado.get("/me", response_model=UsuarioActual)
def me(usuario: UsuarioEnSesion, db: Db) -> UsuarioActual:
    return usuario_actual(db, usuario)


@privado.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    _: UsuarioEnSesion,
    respuesta: Response,
    db: Db,
    sesion: Annotated[str | None, Cookie(alias=COOKIE_SESION)] = None,
) -> None:
    if sesion:
        service.revocar_sesion(db, sesion)
    respuesta.delete_cookie(COOKIE_SESION, path="/api", httponly=True, secure=True, samesite="lax")


@privado.post("/cambiar-clave", status_code=status.HTTP_204_NO_CONTENT)
def cambiar_clave(datos: CambioClave, usuario: UsuarioEnSesion, db: Db) -> None:
    try:
        service.cambiar_clave(db, usuario, datos.clave_actual, datos.clave_nueva)
    except service.CredencialesInvalidas:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "La contraseña actual no es correcta"
        ) from None
    except ValueError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from None
