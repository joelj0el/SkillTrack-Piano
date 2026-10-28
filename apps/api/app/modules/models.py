# Registro de todos los modelos para Alembic y las pruebas.
from app.modules.audit.models import AuditoriaAcceso
from app.modules.catalog.models import ClaseError, Ejercicio, VersionEjercicio
from app.modules.identity.models import SesionAuth, Usuario
from app.modules.institutions.models import AsignacionDocente, Institucion, Membresia

__all__ = [
    "AsignacionDocente",
    "AuditoriaAcceso",
    "ClaseError",
    "Ejercicio",
    "Institucion",
    "Membresia",
    "SesionAuth",
    "Usuario",
    "VersionEjercicio",
]
