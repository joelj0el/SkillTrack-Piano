"""Cuenta pendiente de pago (ADR-005): solo puede consultar su sesión, pagar o cerrar sesión."""

from fastapi import HTTPException, Request, status

from app.core.reloj import hoy_local
from app.modules.identity.deps import UsuarioEnSesion
from app.modules.institutions.deps import Ahora, Db
from app.modules.plans import service

RUTAS_CON_PAGO_PENDIENTE = frozenset(
    {
        "/api/auth/me",
        "/api/auth/logout",
        "/api/mi-pago",
        "/api/mi-pago/qr",
        "/api/mi-pago/verificar",
    }
)


def exigir_cuenta_al_dia(
    request: Request, usuario: UsuarioEnSesion, db: Db, instante: Ahora
) -> None:
    if usuario.superadmin or request.url.path in RUTAS_CON_PAGO_PENDIENTE:
        return
    if service.pago_pendiente(db, usuario.id, hoy_local(instante)):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Tu cuenta está pendiente de pago: completa el pago para usar la aplicación.",
        )
