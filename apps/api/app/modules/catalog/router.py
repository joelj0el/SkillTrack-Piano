from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.contracts_gen.clase_error import ClaseError as ClaseErrorDto
from app.contracts_gen.ejercicio import Ejercicio as EjercicioDto
from app.contracts_gen.referencia import Referencia as ReferenciaDto
from app.contracts_gen.referencia_publicada import ReferenciaPublicada
from app.contracts_gen.referencia_vigente import ReferenciaVigente
from app.core.db import obtener_db
from app.modules.catalog import service
from app.modules.catalog.models import Ejercicio, Referencia, VersionEjercicio
from app.modules.identity.deps import Superadmin
from app.modules.institutions.deps import Ahora
from app.modules.pedagogy.service import error_de_campo

router = APIRouter(prefix="/catalogo", tags=["catalog"])

Db = Annotated[Session, Depends(obtener_db)]
YA_PUBLICADA = HTTPException(status.HTTP_409_CONFLICT, "Esa versión ya está publicada")


@router.get("/ejercicios", response_model=list[EjercicioDto])
def listar_ejercicios(db: Db) -> list[EjercicioDto]:
    return [service.ejercicio_dto(e, v) for e, v in service.ejercicios_vigentes(db)]


@router.get("/ejercicios/{codigo}", response_model=EjercicioDto)
def ver_ejercicio(codigo: str, db: Db) -> EjercicioDto:
    for ejercicio, version in service.ejercicios_vigentes(db):
        if ejercicio.codigo == codigo:
            return service.ejercicio_dto(ejercicio, version)
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Ejercicio no encontrado")


@router.get("/taxonomia", response_model=list[ClaseErrorDto])
def taxonomia(db: Db) -> list[ClaseErrorDto]:
    return [
        ClaseErrorDto(
            id=c.id,
            codigo=c.codigo,
            nombre_pedagogico=c.nombre_pedagogico,
            variable_estudiante=c.variable_estudiante,
            modalidad=c.modalidad,
            version_taxonomia=c.version_taxonomia,
        )
        for c in service.taxonomia_vigente(db)
    ]


@router.post(
    "/referencias", response_model=ReferenciaPublicada, status_code=status.HTTP_201_CREATED
)
def publicar_referencia(
    datos: ReferenciaDto, _: Superadmin, db: Db, instante: Ahora
) -> ReferenciaPublicada:
    """Publica `referencia vN`. Inmutable: una versión que ya existe da 409 (PA-HU22-01)."""
    version = service.version_por_codigo(db, datos.version_ejercicio)
    if version is None:
        raise error_de_campo("version_ejercicio", "La versión de ejercicio no existe.")
    if service.referencia_existe(db, version.id, datos.version):
        raise YA_PUBLICADA
    fila = Referencia(
        version_ejercicio_id=version.id,
        version=datos.version,
        publicada_en=instante,
        **datos.model_dump(
            mode="json",
            include={"bandas", "n_docentes", "rasgos_descartados", "rasgos_sin_evaluar"},
        ),
        metodo=datos.metodo.model_dump(mode="json"),
        origen=datos.origen.model_dump(mode="json"),
    )
    db.add(fila)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise YA_PUBLICADA from None
    return ReferenciaPublicada(
        id=fila.id,
        version=fila.version,
        version_ejercicio_id=fila.version_ejercicio_id,
        publicada_en=fila.publicada_en,
    )


@router.get("/referencias/vigente", response_model=ReferenciaVigente)
def referencia_vigente(version_ejercicio_id: int, db: Db) -> ReferenciaVigente:
    fila = service.referencia_vigente(db, version_ejercicio_id)
    if fila is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sin referencia publicada")
    version = db.get(VersionEjercicio, fila.version_ejercicio_id)
    ejercicio = db.get(Ejercicio, version.ejercicio_id)
    return ReferenciaVigente.model_validate(
        {
            "id": fila.id,
            "version_ejercicio_id": fila.version_ejercicio_id,
            "publicada_en": fila.publicada_en,
            "referencia": {
                "formato": 1,
                "version": fila.version,
                "version_ejercicio": f"{ejercicio.codigo}@{version.version}",
                "n_docentes": fila.n_docentes,
                "metodo": fila.metodo,
                "bandas": fila.bandas,
                "rasgos_descartados": fila.rasgos_descartados,
                "rasgos_sin_evaluar": fila.rasgos_sin_evaluar,
                "origen": fila.origen,
            },
        }
    )
