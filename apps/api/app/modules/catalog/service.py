from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.contracts_gen.ejercicio import Ejercicio as EjercicioDto
from app.contracts_gen.ejercicio import VersionVigente
from app.modules.catalog.models import ClaseError, Ejercicio, VersionEjercicio

VERSION_TAXONOMIA = "v0.1"


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
        version_vigente=VersionVigente(
            id=version.id,
            version=version.version,
            tempo_min_permitido_bpm=version.tempo_min_permitido_bpm,
            tempo_max_permitido_bpm=version.tempo_max_permitido_bpm,
            rango_octavas=version.rango_octavas,
            nota_min_midi=version.nota_min_midi,
            nota_max_midi=version.nota_max_midi,
            eventos_esperados=version.eventos_esperados,
            partitura_svg=version.partitura_svg,
            transcripcion="verificada" if version.eventos_esperados else "pendiente",
        ),
    )
