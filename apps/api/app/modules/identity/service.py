import hashlib
import secrets
from datetime import datetime, timedelta

from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.modules.audit import service as auditoria
from app.modules.identity.models import SesionAuth, Usuario

# PRM-18: intentos fallidos permitidos en la ventana antes del bloqueo.
INTENTOS_FALLIDOS_MAXIMOS = 5
VENTANA_INTENTOS = timedelta(minutes=15)
# PRM-19: una sesión sin actividad durante este tiempo deja de ser válida.
INACTIVIDAD_MAXIMA = timedelta(days=30)

_hasher = PasswordHash((Argon2Hasher(),))
# Hash de referencia para igualar el tiempo de respuesta cuando el usuario no existe.
_HASH_FICTICIO = _hasher.hash(secrets.token_urlsafe(16))
# Sin caracteres ambiguos (0/O, 1/l/I): la clave temporal se dicta en voz alta.
_ALFABETO_CLAVE = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"


class CredencialesInvalidas(Exception):
    pass


class UsuarioBloqueado(Exception):
    pass


def hash_clave(clave: str) -> str:
    return _hasher.hash(clave)


def verificar_clave(hash_guardado: str, clave: str) -> bool:
    return _hasher.verify(clave, hash_guardado)


def generar_clave_temporal(longitud: int = 10) -> str:
    return "".join(secrets.choice(_ALFABETO_CLAVE) for _ in range(longitud))


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def autenticar(db: Session, usuario: str, clave: str, ahora: datetime) -> Usuario:
    encontrado = db.scalar(select(Usuario).where(Usuario.username == usuario))
    if encontrado is None or not encontrado.activo:
        verificar_clave(_HASH_FICTICIO, clave)
        raise CredencialesInvalidas
    if _bloqueado(db, encontrado.id, ahora):
        _auditar(db, encontrado.id, "login_bloqueado", ahora)
        db.commit()
        raise UsuarioBloqueado
    if not verificar_clave(encontrado.hash_clave, clave):
        _auditar(db, encontrado.id, "login_fallido", ahora)
        db.flush()
        fallos = auditoria.contar(
            db,
            accion="login_fallido",
            recurso="usuario",
            recurso_id=encontrado.id,
            desde=ahora - VENTANA_INTENTOS,
        )
        if fallos >= INTENTOS_FALLIDOS_MAXIMOS:
            # El bloqueo dura VENTANA_INTENTOS desde este momento, no desde el primer fallo.
            _auditar(db, encontrado.id, "login_bloqueo_inicio", ahora)
        db.commit()
        raise CredencialesInvalidas
    return encontrado


def _bloqueado(db: Session, usuario_id: int, ahora: datetime) -> bool:
    return (
        auditoria.contar(
            db,
            accion="login_bloqueo_inicio",
            recurso="usuario",
            recurso_id=usuario_id,
            desde=ahora - VENTANA_INTENTOS,
        )
        > 0
    )


def _auditar(db: Session, usuario_id: int, accion: str, ahora: datetime) -> None:
    auditoria.registrar(
        db,
        actor_id=usuario_id,
        accion=accion,
        recurso="usuario",
        recurso_id=usuario_id,
        fecha=ahora,
    )


def crear_sesion(db: Session, usuario: Usuario, ahora: datetime) -> str:
    token = secrets.token_urlsafe(32)
    db.add(
        SesionAuth(
            id=_hash_token(token),
            usuario_id=usuario.id,
            expira_en=ahora + INACTIVIDAD_MAXIMA,
            ultima_actividad=ahora,
        )
    )
    db.commit()
    return token


def usuario_de_sesion(db: Session, token: str, ahora: datetime) -> Usuario | None:
    sesion = db.get(SesionAuth, _hash_token(token))
    if sesion is None:
        return None
    if ahora - sesion.ultima_actividad > INACTIVIDAD_MAXIMA:
        db.delete(sesion)
        db.commit()
        return None
    usuario = db.get(Usuario, sesion.usuario_id)
    if usuario is None or not usuario.activo:
        return None
    sesion.ultima_actividad = ahora
    sesion.expira_en = ahora + INACTIVIDAD_MAXIMA
    db.commit()
    return usuario


def revocar_sesion(db: Session, token: str) -> None:
    db.execute(delete(SesionAuth).where(SesionAuth.id == _hash_token(token)))
    db.commit()


def revocar_sesiones_de(db: Session, usuario_id: int) -> None:
    db.execute(delete(SesionAuth).where(SesionAuth.usuario_id == usuario_id))


def cambiar_clave(db: Session, usuario: Usuario, clave_actual: str, clave_nueva: str) -> None:
    if not verificar_clave(usuario.hash_clave, clave_actual):
        raise CredencialesInvalidas
    if clave_actual == clave_nueva:
        raise ValueError("La contraseña nueva debe ser distinta de la actual.")
    usuario.hash_clave = hash_clave(clave_nueva)
    usuario.clave_temporal = False
    db.commit()
