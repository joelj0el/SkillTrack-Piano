from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.contracts_gen.conjunto_reglas import CodigoIndicador
from app.contracts_gen.ejercicio import Ejercicio as EjercicioDto
from app.contracts_gen.ejercicio import VersionEjercicio as VersionDto
from app.modules.catalog.models import (
    ClaseError,
    ConjuntoReglas,
    Ejercicio,
    Referencia,
    VersionEjercicio,
)

VERSION_TAXONOMIA = "v0.1"
# Los 12 indicadores de la taxonomía, del contrato generado.
CODIGOS_INDICADOR = tuple(c.value for c in CodigoIndicador)


def ejercicios_vigentes(db: Session) -> list[tuple[Ejercicio, VersionEjercicio]]:
    """Ejercicios activos en el orden del panel, cada uno con su versión más reciente."""
    ultima = (
        select(VersionEjercicio.ejercicio_id, func.max(VersionEjercicio.version).label("v"))
        .group_by(VersionEjercicio.ejercicio_id)
        .subquery()
    )
    consulta = (
        select(Ejercicio, VersionEjercicio)
        .join(ultima, ultima.c.ejercicio_id == Ejercicio.id)
        .join(
            VersionEjercicio,
            (VersionEjercicio.ejercicio_id == Ejercicio.id)
            & (VersionEjercicio.version == ultima.c.v),
        )
        .where(Ejercicio.activo)
        .order_by(Ejercicio.orden)
    )
    return [(e, v) for e, v in db.execute(consulta)]


def ejercicio_por_id(db: Session, ejercicio_id: int) -> Ejercicio | None:
    ejercicio = db.get(Ejercicio, ejercicio_id)
    return ejercicio if ejercicio is not None and ejercicio.activo else None


def ejercicios_por_id(db: Session, ids: list[int]) -> dict[int, Ejercicio]:
    if not ids:
        return {}
    return {e.id: e for e in db.scalars(select(Ejercicio).where(Ejercicio.id.in_(ids)))}


def clase_error_por_id(db: Session, clase_id: int) -> ClaseError | None:
    return db.get(ClaseError, clase_id)


def taxonomia_vigente(db: Session) -> list[ClaseError]:
    consulta = (
        select(ClaseError)
        .where(ClaseError.version_taxonomia == VERSION_TAXONOMIA)
        .order_by(ClaseError.codigo)
    )
    return list(db.scalars(consulta))


def ejercicio_dto(ejercicio: Ejercicio, version: VersionEjercicio) -> EjercicioDto:
    return EjercicioDto(
        id=ejercicio.id,
        codigo=ejercicio.codigo,
        nombre=ejercicio.nombre,
        fuente=ejercicio.fuente,
        tonalidad=ejercicio.tonalidad,
        compas=ejercicio.compas,
        figura=ejercicio.figura,
        orden=ejercicio.orden,
        variantes_manos=ejercicio.variantes_manos,
        version_vigente=VersionDto(
            id=version.id,
            version=version.version,
            tempo_min_permitido_bpm=version.tempo_min_permitido_bpm,
            tempo_max_permitido_bpm=version.tempo_max_permitido_bpm,
            rango_octavas=version.rango_octavas,
            nota_min_midi=version.nota_min_midi,
            nota_max_midi=version.nota_max_midi,
            eventos_esperados=version.eventos_esperados,
            partitura_svg=version.partitura_svg,
            transcripcion="importada" if version.eventos_esperados else "pendiente",
        ),
    )


def version_existe(db: Session, version_id: int) -> bool:
    return db.get(VersionEjercicio, version_id) is not None


def version_por_codigo(db: Session, version_ejercicio: str) -> VersionEjercicio | None:
    """'EJ-01@1' → la versión 1 del EJ-01 (así la nombran los artefactos de investigación)."""
    codigo, _, numero = version_ejercicio.partition("@")
    if not numero.isdigit():
        return None
    return db.scalar(
        select(VersionEjercicio)
        .join(Ejercicio, Ejercicio.id == VersionEjercicio.ejercicio_id)
        .where(Ejercicio.codigo == codigo, VersionEjercicio.version == int(numero))
    )


def referencia_existe(db: Session, version_ejercicio_id: int, version: int) -> bool:
    return (
        db.scalar(
            select(Referencia.id).where(
                Referencia.version_ejercicio_id == version_ejercicio_id,
                Referencia.version == version,
            )
        )
        is not None
    )


def referencia_vigente(db: Session, version_ejercicio_id: int) -> Referencia | None:
    return db.scalar(
        select(Referencia)
        .where(Referencia.version_ejercicio_id == version_ejercicio_id)
        .order_by(Referencia.version.desc())
        .limit(1)
    )


def referencia_es_de(db: Session, referencia_id: int, version_ejercicio_id: int) -> bool:
    fila = db.get(Referencia, referencia_id)
    return fila is not None and fila.version_ejercicio_id == version_ejercicio_id


def taxonomia_existe(db: Session, version_taxonomia: str) -> bool:
    consulta = select(ClaseError.id).where(ClaseError.version_taxonomia == version_taxonomia)
    return db.scalar(consulta.limit(1)) is not None


def reglas_existen(db: Session, version: int) -> bool:
    return db.scalar(select(ConjuntoReglas.id).where(ConjuntoReglas.version == version)) is not None


def reglas_vigentes(db: Session) -> ConjuntoReglas | None:
    return db.scalar(select(ConjuntoReglas).order_by(ConjuntoReglas.version.desc()).limit(1))


def reglas_por_id(db: Session, conjunto_id: int) -> ConjuntoReglas | None:
    return db.get(ConjuntoReglas, conjunto_id)


def problemas_del_conjunto(datos: dict) -> list[tuple[list[str | int], str]]:
    """Lo que el modelo generado no expresa: los 12 indicadores y las referencias cruzadas."""
    problemas: list[tuple[list[str | int], str]] = []
    indicadores: dict = datos["indicadores"]
    for codigo in CODIGOS_INDICADOR:
        if codigo not in indicadores:
            problemas.append((["indicadores", codigo], f"Falta {codigo}"))
    for codigo, conf in indicadores.items():
        if conf["clase"] != f"ER-{codigo[4]}":
            problemas.append((["indicadores", codigo, "clase"], f"{codigo} no es de esa clase"))
        if conf["evaluable"] and not any(r["indicador"] == codigo for r in datos["reglas"]):
            problemas.append((["indicadores", codigo], f"{codigo} es evaluable sin reglas"))
    vistos: set[str] = set()
    for i, regla in enumerate(datos["reglas"]):
        if regla["id"] in vistos:
            problemas.append((["reglas", i, "id"], f"{regla['id']} repetida"))
        vistos.add(regla["id"])
        conf = indicadores.get(regla["indicador"])
        if conf is not None and not conf["evaluable"]:
            problemas.append((["reglas", i, "indicador"], "Indicador no evaluable por diseño"))
    return problemas
