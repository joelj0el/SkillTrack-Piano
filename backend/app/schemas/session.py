import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class VisionError(BaseModel):
    notePosition: int
    finger: int
    hand: Literal["left", "right"]
    errorType: Literal["wrong_finger", "curvature", "timing", "missed"]
    severity: Literal["low", "medium", "high"]
    detectedValue: float | None = None
    expectedValue: float | None = None


class AudioEvent(BaseModel):
    timestamp: float
    frequency: float
    onsetDetected: bool
    rhythmConformity: float


class FusedEvent(BaseModel):
    notePosition: int
    timestamp: float
    visionConfirmed: bool
    audioConfirmed: bool
    resolved: bool


class FeedbackItem(BaseModel):
    notePosition: int | None = None
    message: str
    category: str | None = None
    severity: Literal["low", "medium", "high"] | None = None


class SessionResult(BaseModel):
    """Contrato cliente↔servidor: resultado completo enviado tras el análisis on-device."""

    sessionId: uuid.UUID
    exerciseId: uuid.UUID
    studentId: uuid.UUID
    startedAt: datetime
    endedAt: datetime
    referenceThresholdVersion: int
    visionErrors: list[VisionError] = []
    audioEvents: list[AudioEvent] = []
    fusionEvents: list[FusedEvent] = []
    feedbackSummary: list[FeedbackItem] = []
    overallScore: float | None = None


class SessionCreate(BaseModel):
    student_id: uuid.UUID
    exercise_id: uuid.UUID


class SessionOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    exercise_id: uuid.UUID
    started_at: datetime | None
    ended_at: datetime | None
    status: str
    reference_threshold_version: int | None
    created_at: datetime

    class Config:
        from_attributes = True


class SessionMetricOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    raw_result: dict
    vision_errors: list | dict | None = None
    audio_events: list | dict | None = None
    fusion_events: list | dict | None = None
    feedback_summary: list | dict | None = None
    overall_score: float | None = None
    created_at: datetime

    class Config:
        from_attributes = True
