import uuid

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class PracticeSession(Base):
    __tablename__ = "practice_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    exercise_id = Column(UUID(as_uuid=True), ForeignKey("exercises.id"), nullable=False)
    started_at = Column(DateTime(timezone=True))
    ended_at = Column(DateTime(timezone=True))
    status = Column(String(20), default="recording")
    reference_threshold_version = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    metrics = relationship("SessionMetric", back_populates="session", uselist=False)


class SessionMetric(Base):
    __tablename__ = "session_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("practice_sessions.id"), unique=True, nullable=False)
    raw_result = Column(JSONB, nullable=False)
    vision_errors = Column(JSONB)
    audio_events = Column(JSONB)
    fusion_events = Column(JSONB)
    feedback_summary = Column(JSONB)
    overall_score = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("PracticeSession", back_populates="metrics")
