import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.pedagogy import (
    AssignedTaskCreate,
    AssignedTaskOut,
    AssignedTaskUpdate,
    ObservationCreate,
    ObservationOut,
)
from app.services import pedagogy_service

router = APIRouter(tags=["pedagogy"])


@router.get("/tasks", response_model=list[AssignedTaskOut])
async def list_tasks(
    student_id: uuid.UUID | None = None,
    teacher_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    return await pedagogy_service.list_tasks(db, student_id, teacher_id)


@router.post("/tasks", response_model=AssignedTaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(data: AssignedTaskCreate, db: AsyncSession = Depends(get_db)):
    return await pedagogy_service.create_task(db, data)


@router.put("/tasks/{task_id}", response_model=AssignedTaskOut)
async def update_task(task_id: uuid.UUID, data: AssignedTaskUpdate, db: AsyncSession = Depends(get_db)):
    task = await pedagogy_service.update_task(db, task_id, data)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada")
    return task


@router.post("/observations", response_model=ObservationOut, status_code=status.HTTP_201_CREATED)
async def create_observation(data: ObservationCreate, db: AsyncSession = Depends(get_db)):
    return await pedagogy_service.create_observation(db, data)


@router.get("/observations/student/{student_id}", response_model=list[ObservationOut])
async def get_student_observations(student_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await pedagogy_service.list_observations(db, student_id)
