"""Dependencias de autorización reutilizables: rol de la membresía + pertenencia."""

from datetime import datetime
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import obtener_db
from app.core.reloj import ahora, hoy_local
from app.modules.audit import service as auditoria
from app.modules.identity.deps import UsuarioEnSesion
from app.modules.institutions import service

Db = Annotated[Session, Depends(obtener_db)]
Ahora = Annotated[datetime, Depends(ahora)]

PROHIBIDO = HTTPException(status.HTTP_403_FORBIDDEN, "No tienes acceso a este recurso")


def exigir_admin_institucion(institucion_id: int, usuario: UsuarioEnSesion, db: Db) -> int:
    if not (usuario.superadmin or service.es_admin_de(db, usuario.id, institucion_id)):
        raise PROHIBIDO
    return institucion_id


def puede_ver_estudiante(
    db: Session, actor_id: int, superadmin: bool, estudiante_id: int, instante: datetime
) -> bool:
    if superadmin or service.asignacion_vigente(db, actor_id, estudiante_id, hoy_local(instante)):
        return True
    instituciones_del_estudiante = set(service.instituciones_de(db, estudiante_id, "estudiante"))
    return any(service.es_admin_de(db, actor_id, i) for i in instituciones_del_estudiante)


def exigir_acceso_a_estudiante(
    estudiante_id: int, usuario: UsuarioEnSesion, db: Db, instante: Ahora
) -> int:
    """Docente con asignación vigente o administrador de la institución del estudiante.

    Cada acceso queda en auditoria_acceso, también los rechazados."""
    permitido = puede_ver_estudiante(db, usuario.id, usuario.superadmin, estudiante_id, instante)
    auditoria.registrar(
        db,
        actor_id=usuario.id,
        accion="leer_estudiante" if permitido else "acceso_denegado",
        recurso="estudiante",
        recurso_id=estudiante_id,
        fecha=instante,
    )
    db.commit()
    if not permitido:
        raise PROHIBIDO
    return estudiante_id


AdminDeInstitucion = Annotated[int, Depends(exigir_admin_institucion)]
EstudianteAccesible = Annotated[int, Depends(exigir_acceso_a_estudiante)]
