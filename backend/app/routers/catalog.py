import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user_role
from app.database import get_db
from app.schemas.catalog import ExerciseCreate, ExerciseDetailOut, ExerciseOut, ExerciseUpdate
from app.services import catalog_service

router = APIRouter(prefix="/exercises", tags=["catalog"])


@router.get("", response_model=list[ExerciseOut])
async def list_exercises(limit: int = 20, offset: int = 0, db: AsyncSession = Depends(get_db)):
    return await catalog_service.list_exercises(db, limit=limit, offset=offset)


@router.get("/{exercise_id}", response_model=ExerciseDetailOut)
async def get_exercise(exercise_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    exercise = await catalog_service.get_exercise_detail(db, exercise_id)
    if exercise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ejercicio no encontrado")
    return exercise


@router.post("", response_model=ExerciseOut, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    data: ExerciseCreate,
    db: AsyncSession = Depends(get_db),
    role: str = Depends(get_current_user_role),
):
    if role not in ("teacher", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    return await catalog_service.create_exercise(db, data)


@router.put("/{exercise_id}", response_model=ExerciseOut)
async def update_exercise(
    exercise_id: uuid.UUID,
    data: ExerciseUpdate,
    db: AsyncSession = Depends(get_db),
    role: str = Depends(get_current_user_role),
):
    if role not in ("teacher", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    exercise = await catalog_service.update_exercise(db, exercise_id, data)
    if exercise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ejercicio no encontrado")
    return exercise
