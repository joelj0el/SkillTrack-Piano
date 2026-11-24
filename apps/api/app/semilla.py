"""Datos de demostración FICTICIOS para el entorno local (docker compose). Idempotente.

Solo actúa si SEMILLA_DEMO=1. Crea una institución con 1 administrador, 2 docentes, 3 estudiantes
y 1 investigador, 1 superadministrador (publica la referencia y las reglas), las asignaciones y tareas con observaciones (una de ellas vencida). La
contraseña común sale de SEMILLA_CLAVE (solo para desarrollo). Los nombres son inventados.

Los intentos de demostración (solo los del estudiante demo, a lo largo de 6 semanas) son
FICTICIOS: llevan MARCA_DEMO en la versión del núcleo y en la clase de dispositivo, y no cuentan
para ninguna tarea. Sirven para que los gráficos se vean en una demostración local.

Uso: python -m app.semilla
"""

import os
import uuid
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.core.db import crear_engine
from app.modules.attempts.models import Intento
from app.modules.catalog.models import ClaseError, VersionEjercicio
from app.modules.identity.models import Usuario
from app.modules.identity.service import hash_clave
from app.modules.institutions.models import AsignacionDocente, Institucion, Membresia
from app.modules.pedagogy.models import Observacion, Tarea
from app.modules.plans.models import Plan

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
# Sin institución: solo publica artefactos del catálogo (referencia, reglas).
SUPERADMIN = ("superadmin.demo", "Superadministración (demo)")
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
    if db.scalar(select(Usuario.id).where(Usuario.username == SUPERADMIN[0])) is None:
        db.add(
            Usuario(
                username=SUPERADMIN[0],
                nombre_visible=SUPERADMIN[1],
                hash_clave=hash_clave(clave),
                clave_temporal=False,
                es_menor=False,
                superadmin=True,
            )
        )
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


MARCA_DEMO = "demostración"
SEMANAS_DEMO = 6
INTENTOS_POR_SEMANA = 3
# % de partida y mejora semanal de cada variable evaluable (ficticios). E y F quedan sin evaluar,
# como en la plantilla de reglas v1 ("no evaluable por diseño").
BASE_DEMO = {"ER-A": (72, 4), "ER-B": (52, 6), "ER-C": (64, 5), "ER-D": (76, 3)}
INDICADOR_DEMO = {"ER-A": "IND-A1", "ER-B": "IND-B2", "ER-C": "IND-C1", "ER-D": "IND-D1"}


def _nivel(pct: float) -> str:
    return "logrado" if pct >= 90 else "en-desarrollo" if pct >= 70 else "por-mejorar"


def sembrar_intentos_demo(db: Session, hoy: date) -> int:
    """Intentos ficticios del estudiante demo en las 2 primeras tareas. Devuelve cuántos creó."""
    ana = db.scalar(select(Usuario).where(Usuario.username == "estudiante.demo"))
    if ana is None:
        return 0
    ya = db.scalar(
        select(Intento.id).where(
            Intento.estudiante_id == ana.id, Intento.clase_dispositivo == MARCA_DEMO
        )
    )
    if ya is not None:
        return 0
    tareas = list(
        db.scalars(select(Tarea).where(Tarea.estudiante_id == ana.id).order_by(Tarea.id).limit(2))
    )
    if not tareas:
        return 0
    creados = 0
    for semana in range(SEMANAS_DEMO):
        for k in range(INTENTOS_POR_SEMANA):
            n = semana * INTENTOS_POR_SEMANA + k
            tarea = tareas[n % len(tareas)]
            version = db.scalar(
                select(VersionEjercicio.id)
                .where(VersionEjercicio.ejercicio_id == tarea.ejercicio_id)
                .order_by(VersionEjercicio.version.desc())
            )
            dia = hoy - timedelta(days=7 * (SEMANAS_DEMO - 1 - semana) + 2 * k)
            calificacion = []
            indicadores = []
            for clase, (base, mejora) in BASE_DEMO.items():
                pct = float(min(98, base + mejora * semana + (n * 3) % 7 - 3))
                calificacion.append({"clase": clase, "nivel": _nivel(pct), "pct": pct})
                if pct < 90:
                    indicadores.append(INDICADOR_DEMO[clase])
            for clase in ("ER-E", "ER-F"):
                calificacion.append({"clase": clase, "nivel": "no-evaluado", "pct": None})
            db.add(
                Intento(
                    client_uuid=str(uuid.uuid5(uuid.NAMESPACE_URL, f"skilltrack-demo/{n}")),
                    estudiante_id=ana.id,
                    version_ejercicio_id=version,
                    tarea_id=tarea.id,
                    version_nucleo=MARCA_DEMO,
                    version_modelo_mano=MARCA_DEMO,
                    instrumento="digital",
                    manos=tarea.manos,
                    clase_dispositivo=MARCA_DEMO,
                    modo="VA",
                    modo_metronomo="con",
                    tempo_elegido_bpm=tarea.tempo_min_bpm,
                    tempo_medido_bpm=None,
                    estado="evaluado",
                    cuenta_para_tarea=False,
                    motivo_no_cuenta="Dato de demostración",
                    iniciado_en=datetime.combine(dia, time(21, 0), UTC),
                    duracion_ms=0,
                    eventos=[],
                    calificacion=calificacion,
                    indicadores_deficientes=sorted(indicadores),
                )
            )
            creados += 1
    db.commit()
    return creados


# Planes de la página de inicio (ADR-004). Sin precios ni límites: el autor todavía no los
# definió, así que quedan vacíos y la interfaz muestra "Bs —" y "—".
PLANES_DEMO = [
    (
        "Docente",
        "Para un docente y sus estudiantes",
        [
            "1 docente",
            "Catálogo de ejercicios con partitura y digitación",
            "Asignación de tareas con tempo y repeticiones",
            "Análisis de cada intento con resultado nota por nota",
            "Seguimiento de cada estudiante",
        ],
        False,
    ),
    (
        "Institución",
        "Para escuelas y conservatorios con varios docentes",
        [
            "Varios docentes",
            "Todo lo del plan Docente",
            "Administración de usuarios por la institución",
            "Vista «Mi grupo» para cada docente",
            "Soporte para la puesta en marcha",
        ],
        True,
    ),
    (
        "Convenio especial",
        "Para conservatorios e institutos",
        [
            "Condiciones a medida para conservatorios e institutos",
            "Cantidad de docentes y estudiantes a convenir",
            "Acompañamiento en la capacitación",
            "Precio según el convenio",
        ],
        False,
    ),
]


def sembrar_planes(db: Session) -> int:
    """Crea los planes que falten (por nombre). Devuelve cuántos creó."""
    creados = 0
    for orden, (nombre, descripcion, beneficios, destacado) in enumerate(PLANES_DEMO):
        if db.scalar(select(Plan.id).where(Plan.nombre == nombre)) is not None:
            continue
        db.add(
            Plan(
                nombre=nombre,
                descripcion=descripcion,
                beneficios=beneficios,
                precio_bs=None,
                periodo="mensual",
                limite_docentes=None,
                limite_estudiantes=None,
                destacado=destacado,
                activo=True,
                orden=orden,
            )
        )
        creados += 1
    db.commit()
    return creados


def main() -> None:
    if os.environ.get("SEMILLA_DEMO") != "1":
        return
    clave = os.environ.get("SEMILLA_CLAVE", "")
    if len(clave) < 8:
        raise SystemExit("SEMILLA_CLAVE debe tener al menos 8 caracteres.")
    with sessionmaker(crear_engine())() as db:
        creada = sembrar(db, clave, date.today())
        intentos = sembrar_intentos_demo(db, date.today())
        sembrar_planes(db)
    print("Demostración creada." if creada else "La demostración ya existía.")
    if intentos:
        print(f"Intentos de demostración agregados: {intentos}.")


if __name__ == "__main__":
    main()
