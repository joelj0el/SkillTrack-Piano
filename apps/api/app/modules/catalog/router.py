from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.contracts_gen.clase_error import ClaseError as ClaseErrorDto
from app.contracts_gen.ejercicio import Ejercicio as EjercicioDto
from app.core.db import obtener_db
from app.modules.catalog import service

router = APIRouter(prefix="/catalogo", tags=["catalog"])

Db = Annotated[Session, Depends(obtener_db)]


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
