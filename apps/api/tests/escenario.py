"""Escenario de dos instituciones para las pruebas de autorización ("docente ajeno → 403")."""

from dataclasses import dataclass
from datetime import date

from sqlalchemy.orm import Session

from app.modules.identity.models import Usuario
from app.modules.institutions.models import AsignacionDocente, Institucion
from tests import fabricas


@dataclass
class Escenario:
    inst_a: Institucion
    inst_b: Institucion
    admin_a: Usuario
    docente_a: Usuario
    docente_a2: Usuario  # misma institución, sin asignación con el estudiante
    estudiante_a: Usuario
    estudiante_a2: Usuario
    admin_b: Usuario
    docente_b: Usuario
    estudiante_b: Usuario

    def ajenos_a_estudiante_a(self) -> list[Usuario]:
        """Usuarios que nunca deben acceder a los datos de estudiante_a."""
        return [
            self.docente_a2,
            self.estudiante_a2,
            self.admin_b,
            self.docente_b,
            self.estudiante_b,
        ]


def crear(db: Session, desde: date = date(2026, 11, 1)) -> Escenario:
    inst_a = fabricas.institucion(db, "Instituto A")
    inst_b = fabricas.institucion(db, "Instituto B")
    e = Escenario(
        inst_a=inst_a,
        inst_b=inst_b,
        admin_a=fabricas.usuario(db, "admin.a", rol="admin_inst", inst=inst_a),
        docente_a=fabricas.usuario(db, "docente.a", rol="docente", inst=inst_a),
        docente_a2=fabricas.usuario(db, "docente.a2", rol="docente", inst=inst_a),
        estudiante_a=fabricas.usuario(
            db, "estudiante.a", rol="estudiante", inst=inst_a, es_menor=True
        ),
        estudiante_a2=fabricas.usuario(db, "estudiante.a2", rol="estudiante", inst=inst_a),
        admin_b=fabricas.usuario(db, "admin.b", rol="admin_inst", inst=inst_b),
        docente_b=fabricas.usuario(db, "docente.b", rol="docente", inst=inst_b),
        estudiante_b=fabricas.usuario(db, "estudiante.b", rol="estudiante", inst=inst_b),
    )
    db.add(
        AsignacionDocente(
            institucion_id=inst_a.id,
            docente_id=e.docente_a.id,
            estudiante_id=e.estudiante_a.id,
            desde=desde,
        )
    )
    db.commit()
    return e
