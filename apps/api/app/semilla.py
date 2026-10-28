"""Datos de demostración para el entorno local (docker compose). Idempotente.

Solo actúa si SEMILLA_DEMO=1. Crea una institución con un usuario de cada rol y asigna el
estudiante al docente. La contraseña común sale de SEMILLA_CLAVE (solo para desarrollo).

Uso: python -m app.semilla
"""

import os
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.core.db import crear_engine
from app.modules.identity.models import Usuario
from app.modules.identity.service import hash_clave
from app.modules.institutions.models import AsignacionDocente, Institucion, Membresia

INSTITUCION = "Instituto de demostración"
USUARIOS = [
    ("admin.demo", "Administración (demo)", "admin_inst"),
    ("docente.demo", "Docente (demo)", "docente"),
    ("estudiante.demo", "Estudiante (demo)", "estudiante"),
    ("investigador.demo", "Investigación (demo)", "investigador"),
]


def sembrar(db: Session, clave: str, hoy: date) -> bool:
    """Devuelve False si la demostración ya existía."""
    if db.scalar(select(Usuario.id).where(Usuario.username == USUARIOS[0][0])) is not None:
        return False
    institucion = Institucion(nombre=INSTITUCION)
    db.add(institucion)
    db.flush()
    ids: dict[str, int] = {}
    for username, nombre, rol in USUARIOS:
        usuario = Usuario(
            username=username,
            nombre_visible=nombre,
            hash_clave=hash_clave(clave),
            clave_temporal=False,
        )
        db.add(usuario)
        db.flush()
        db.add(Membresia(usuario_id=usuario.id, institucion_id=institucion.id, rol=rol))
        ids[rol] = usuario.id
    db.add(
        AsignacionDocente(
            institucion_id=institucion.id,
            docente_id=ids["docente"],
            estudiante_id=ids["estudiante"],
            desde=hoy,
        )
    )
    db.commit()
    return True


def main() -> None:
    if os.environ.get("SEMILLA_DEMO") != "1":
        return
    clave = os.environ.get("SEMILLA_CLAVE", "")
    if len(clave) < 8:
        raise SystemExit("SEMILLA_CLAVE debe tener al menos 8 caracteres.")
    with sessionmaker(crear_engine())() as db:
        creada = sembrar(db, clave, date.today())
    print("Demostración creada." if creada else "La demostración ya existía.")


if __name__ == "__main__":
    main()
