# Registro de todos los modelos para Alembic y las pruebas.
from app.modules.audit.models import AuditoriaAcceso
from app.modules.catalog.models import ClaseError, Ejercicio, VersionEjercicio
from app.modules.identity.models import SesionAuth, Usuario
from app.modules.institutions.models import AsignacionDocente, Institucion, Membresia
from app.modules.pedagogy.models import Observacion, Tarea

__all__ = [
    "AsignacionDocente",
    "AuditoriaAcceso",
    "ClaseError",
    "Ejercicio",
    "Institucion",
    "Membresia",
    "Observacion",
    "SesionAuth",
    "Tarea",
    "Usuario",
    "VersionEjercicio",
]
