"""Datos de demostración FICTICIOS para el entorno local (docker compose). Idempotente.

Solo actúa si SEMILLA_DEMO=1. Crea una institución con 1 administrador, 2 docentes, 3 estudiantes
y 1 investigador, las asignaciones y tareas con observaciones (una de ellas vencida). La
contraseña común sale de SEMILLA_CLAVE (solo para desarrollo). Los nombres son inventados.

Uso: python -m app.semilla
"""

import os
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.core.db import crear_engine
from app.modules.catalog.models import ClaseError
from app.modules.identity.models import Usuario
from app.modules.identity.service import hash_clave
from app.modules.institutions.models import AsignacionDocente, Institucion, Membresia
from app.modules.pedagogy.models import Observacion, Tarea

INSTITUCION = "Instituto de demostración"
USUARIOS = [
    ("admin.demo", "Marta Quispe (administración)", "admin_inst", False),
    ("docente.demo", "Prof. Carlos Vargas", "docente", False),
    ("docente2.demo", "Prof. Lucía Mamani", "docente", False),
    ("estudiante.demo", "Ana Rojas", "estudiante", True),
    ("estudiante2.demo", "Diego Flores", "estudiante", True),
    ("estudiante3.demo", "Sofía Choque", "estudiante", False),
    ("investigador.demo", "Investigación (demo)", "investigador", False),
]
ASIGNACIONES = [
    ("docente.demo", "estudiante.demo"),
    ("docente.demo", "estudiante2.demo"),
    ("docente2.demo", "estudiante3.demo"),
]


def _tarea(estudiante, docente, inst, ejercicio, manos, tempos, reps, plazo: date) -> Tarea:
    return Tarea(
        institucion_id=inst.id,
        docente_id=docente.id,
        estudiante_id=estudiante.id,
        ejercicio_id=ejercicio,
        manos=manos,
        tempo_min_bpm=tempos[0],
        tempo_max_bpm=tempos[1],
        repeticiones_por_dia=reps,
        fecha_limite=plazo,
    )


def sembrar(db: Session, clave: str, hoy: date) -> bool:
    """Devuelve False si la demostración completa ya existía."""
    if db.scalar(select(Usuario.id).where(Usuario.username == "estudiante3.demo")) is not None:
        return False
    institucion = db.scalar(select(Institucion).where(Institucion.nombre == INSTITUCION))
    if institucion is None:
        institucion = Institucion(nombre=INSTITUCION)
        db.add(institucion)
        db.flush()
    usuarios: dict[str, Usuario] = {}
    for username, nombre, rol, menor in USUARIOS:
        usuario = db.scalar(select(Usuario).where(Usuario.username == username))
        if usuario is None:
            usuario = Usuario(
                username=username,
                nombre_visible=nombre,
                hash_clave=hash_clave(clave),
                clave_temporal=False,
                es_menor=menor,
            )
            db.add(usuario)
            db.flush()
            db.add(Membresia(usuario_id=usuario.id, institucion_id=institucion.id, rol=rol))
        usuarios[username] = usuario
    for docente, estudiante in ASIGNACIONES:
        existe = db.scalar(
            select(AsignacionDocente.id).where(
                AsignacionDocente.docente_id == usuarios[docente].id,
                AsignacionDocente.estudiante_id == usuarios[estudiante].id,
            )
        )
        if existe is None:
            db.add(
                AsignacionDocente(
                    institucion_id=institucion.id,
                    docente_id=usuarios[docente].id,
                    estudiante_id=usuarios[estudiante].id,
                    desde=hoy - timedelta(days=14),
                )
            )
    db.flush()

    doc, doc2 = usuarios["docente.demo"], usuarios["docente2.demo"]
    ana, diego, sofia = (
        usuarios[u] for u in ("estudiante.demo", "estudiante2.demo", "estudiante3.demo")
    )
    tareas = [
        _tarea(ana, doc, institucion, 1, "juntas", (60, 70), 3, hoy + timedelta(days=5)),
        _tarea(ana, doc, institucion, 2, "MD", (60, 65), 2, hoy + timedelta(days=9)),
        # Vencida: el plazo ya pasó (solo la semilla puede crear una tarea así).
        _tarea(ana, doc, institucion, 3, "MI", (60, 70), 3, hoy - timedelta(days=2)),
        _tarea(diego, doc, institucion, 1, "MD", (60, 70), 4, hoy + timedelta(days=6)),
        _tarea(sofia, doc2, institucion, 4, "juntas", (65, 75), 2, hoy + timedelta(days=7)),
    ]
    db.add_all(tareas)
    db.flush()

    aspectos = {c.codigo: c.id for c in db.scalars(select(ClaseError))}
    ahora = datetime.now(UTC)
    observaciones = [
        (
            tareas[0],
            "ER-B",
            "Mejora el pulso, tratando de contar en voz alta los primeros compases, para que no aceleres al subir.",
            3,
        ),
        (
            tareas[0],
            "ER-E",
            "Mejora la curvatura de los dedos, tratando de imaginar una pelota bajo la palma, para que toques con la yema.",
            1,
        ),
        (
            tareas[1],
            None,
            "Mejora el paso del pulgar, tratando de practicar despacio solo ese tramo, para que la escala no se corte.",
            2,
        ),
        (
            tareas[2],
            "ER-A",
            "Revisa el Mi♭ de la bajada, tratando de mirar la armadura antes de empezar, para que no toques Mi natural.",
            5,
        ),
        (
            tareas[3],
            "ER-C",
            "Mejora la digitación de la subida, tratando de seguir los números de la partitura, para que el paso del pulgar sea cómodo.",
            1,
        ),
        (
            tareas[4],
            "ER-F",
            "Mejora la soltura de la muñeca, tratando de dejarla acompañar a la mano, para que no se tensen los dedos.",
            2,
        ),
    ]
    for tarea, aspecto, texto, dias in observaciones:
        db.add(
            Observacion(
                docente_id=tarea.docente_id,
                estudiante_id=tarea.estudiante_id,
                tarea_id=tarea.id,
                clase_error_id=aspectos.get(aspecto) if aspecto else None,
                texto=texto,
                creada_en=ahora - timedelta(days=dias),
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
