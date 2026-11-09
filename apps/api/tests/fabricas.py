"""Datos sintéticos para las pruebas."""

from sqlalchemy.orm import Session

from app.modules.identity.models import Usuario
from app.modules.identity.service import hash_clave
from app.modules.institutions.models import Institucion, Membresia

CLAVE = "clave-de-prueba-1"


def institucion(db: Session, nombre: str = "Instituto A") -> Institucion:
    fila = Institucion(nombre=nombre)
    db.add(fila)
    db.commit()
    return fila


def usuario(
    db: Session,
    username: str,
    *,
    rol: str | None = None,
    inst: Institucion | None = None,
    clave: str = CLAVE,
    clave_temporal: bool = False,
    superadmin: bool = False,
    es_menor: bool = False,
) -> Usuario:
    fila = Usuario(
        username=username,
        nombre_visible=username.title(),
        hash_clave=hash_clave(clave),
        clave_temporal=clave_temporal,
        superadmin=superadmin,
        es_menor=es_menor,
    )
    db.add(fila)
    db.flush()
    if rol is not None and inst is not None:
        db.add(Membresia(usuario_id=fila.id, institucion_id=inst.id, rol=rol))
    db.commit()
    return fila
