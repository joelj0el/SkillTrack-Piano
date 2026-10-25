import uuid
from datetime import date, datetime

from pydantic import BaseModel


class AssignedTaskCreate(BaseModel):
    teacher_id: uuid.UUID
    student_id: uuid.UUID
    exercise_id: uuid.UUID
    due_date: date | None = None
    tempo_bpm: int | None = None
    notes: str | None = None


class AssignedTaskUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None
    due_date: date | None = None
    tempo_bpm: int | None = None


class AssignedTaskOut(BaseModel):
    id: uuid.UUID
    teacher_id: uuid.UUID
    student_id: uuid.UUID
    exercise_id: uuid.UUID
    due_date: date | None
    tempo_bpm: int | None
    notes: str | None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ObservationCreate(BaseModel):
    teacher_id: uuid.UUID
    student_id: uuid.UUID
    session_id: uuid.UUID | None = None
    content: str


class ObservationOut(BaseModel):
    id: uuid.UUID
    teacher_id: uuid.UUID
    student_id: uuid.UUID
    session_id: uuid.UUID | None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True
