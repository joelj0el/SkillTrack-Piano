import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pedagogy import AssignedTask, Observation
from app.schemas.pedagogy import AssignedTaskCreate, AssignedTaskUpdate, ObservationCreate


async def list_tasks(db: AsyncSession, student_id: uuid.UUID | None = None) -> list[AssignedTask]:
    query = select(AssignedTask)
    if student_id:
        query = query.where(AssignedTask.student_id == student_id)
    result = await db.execute(query.order_by(AssignedTask.created_at.desc()))
    return list(result.scalars().all())


async def create_task(db: AsyncSession, data: AssignedTaskCreate) -> AssignedTask:
    task = AssignedTask(**data.model_dump())
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


async def update_task(db: AsyncSession, task_id: uuid.UUID, data: AssignedTaskUpdate) -> AssignedTask | None:
    result = await db.execute(select(AssignedTask).where(AssignedTask.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    await db.commit()
    await db.refresh(task)
    return task


async def create_observation(db: AsyncSession, data: ObservationCreate) -> Observation:
    observation = Observation(**data.model_dump())
    db.add(observation)
    await db.commit()
    await db.refresh(observation)
    return observation


async def list_observations(db: AsyncSession, student_id: uuid.UUID) -> list[Observation]:
    result = await db.execute(
        select(Observation)
        .where(Observation.student_id == student_id)
        .order_by(Observation.created_at.desc())
    )
    return list(result.scalars().all())
