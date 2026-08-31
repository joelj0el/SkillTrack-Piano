import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ExpectedScoreOut(BaseModel):
    id: uuid.UUID
    version: int
    score_data: dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class ReferenceThresholdOut(BaseModel):
    id: uuid.UUID
    version: int
    thresholds: dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class ExerciseBase(BaseModel):
    title: str
    description: str | None = None
    difficulty_level: str | None = None
    hand: str = "right"
    tempo_bpm: int | None = None
    key_signature: str | None = None
    octaves: int | None = None
    exercise_type: str = "exercise"


class ExerciseCreate(ExerciseBase):
    pass


class ExerciseUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    difficulty_level: str | None = None
    hand: str | None = None
    tempo_bpm: int | None = None
    key_signature: str | None = None
    octaves: int | None = None
    exercise_type: str | None = None
    is_active: bool | None = None


class ExerciseOut(ExerciseBase):
    id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExerciseDetailOut(ExerciseOut):
    expected_score: ExpectedScoreOut | None = None
    reference_thresholds: list[ReferenceThresholdOut] = []
