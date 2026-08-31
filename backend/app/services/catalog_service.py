import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.catalog import Exercise
from app.schemas.catalog import ExerciseCreate, ExerciseUpdate


async def list_exercises(db: AsyncSession, limit: int = 20, offset: int = 0) -> list[Exercise]:
    result = await db.execute(
        select(Exercise).where(Exercise.is_active.is_(True)).limit(limit).offset(offset)
    )
    return list(result.scalars().all())


async def get_exercise_detail(db: AsyncSession, exercise_id: uuid.UUID) -> Exercise | None:
    result = await db.execute(
        select(Exercise)
        .where(Exercise.id == exercise_id)
        .options(
            selectinload(Exercise.expected_score),
            selectinload(Exercise.reference_thresholds),
        )
    )
    return result.scalar_one_or_none()


async def create_exercise(db: AsyncSession, data: ExerciseCreate) -> Exercise:
    exercise = Exercise(**data.model_dump())
    db.add(exercise)
    await db.commit()
    await db.refresh(exercise)
    return exercise


async def update_exercise(db: AsyncSession, exercise_id: uuid.UUID, data: ExerciseUpdate) -> Exercise | None:
    result = await db.execute(select(Exercise).where(Exercise.id == exercise_id))
    exercise = result.scalar_one_or_none()
    if exercise is None:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(exercise, field, value)
    await db.commit()
    await db.refresh(exercise)
    return exercise
