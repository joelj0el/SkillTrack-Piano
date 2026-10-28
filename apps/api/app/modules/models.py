# Registro de todos los modelos para Alembic y las pruebas.
from app.modules.audit.models import AuditoriaAcceso
from app.modules.identity.models import SesionAuth, Usuario
from app.modules.institutions.models import Institucion, Membresia

__all__ = ["AuditoriaAcceso", "Institucion", "Membresia", "SesionAuth", "Usuario"]
