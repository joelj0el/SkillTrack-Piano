from datetime import date

from sqlalchemy.orm import Session

from app.modules.institutions import service
from app.modules.institutions.models import AsignacionDocente
from tests import fabricas

HOY = date(2026, 11, 10)


def _asignar(db: Session, docente, estudiante, inst, *, desde=HOY, hasta=None):
    db.add(
        AsignacionDocente(
            institucion_id=inst.id,
            docente_id=docente.id,
            estudiante_id=estudiante.id,
            desde=desde,
            hasta=hasta,
        )
    )
    db.commit()


def test_pu_institutions_01_la_asignacion_es_vigente_hasta_el_dia_de_fin(db: Session):
    inst = fabricas.institucion(db)
    doc = fabricas.usuario(db, "doc", rol="docente", inst=inst)
    est = fabricas.usuario(db, "est", rol="estudiante", inst=inst)
    _asignar(db, doc, est, inst, hasta=date(2026, 11, 12))

    assert service.asignacion_vigente(db, doc.id, est.id, HOY)
    assert service.asignacion_vigente(db, doc.id, est.id, date(2026, 11, 11))
    # La fecha de fin es el primer día sin acceso (PA-HU31-03: "fecha de fin = hoy").
    assert not service.asignacion_vigente(db, doc.id, est.id, date(2026, 11, 12))


def test_pu_institutions_02_un_estudiante_puede_tener_dos_docentes(db: Session):
    inst = fabricas.institucion(db)
    doc1 = fabricas.usuario(db, "doc1", rol="docente", inst=inst)
    doc2 = fabricas.usuario(db, "doc2", rol="docente", inst=inst)
    est = fabricas.usuario(db, "est", rol="estudiante", inst=inst)
    _asignar(db, doc1, est, inst)
    _asignar(db, doc2, est, inst)

    assert service.estudiantes_de(db, doc1.id, HOY) == [est.id]
    assert service.estudiantes_de(db, doc2.id, HOY) == [est.id]
