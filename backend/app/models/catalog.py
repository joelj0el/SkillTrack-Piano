import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    difficulty_level = Column(String(50))
    hand = Column(String(10))
    tempo_bpm = Column(Integer)
    key_signature = Column(String(20))
    octaves = Column(Integer)
    exercise_type = Column(String(50))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    expected_score = relationship("ExpectedScore", back_populates="exercise", uselist=False)
    reference_thresholds = relationship("ReferenceThreshold", back_populates="exercise")


class ExpectedScore(Base):
    __tablename__ = "expected_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exercise_id = Column(UUID(as_uuid=True), ForeignKey("exercises.id"), unique=True, nullable=False)
    version = Column(Integer, default=1)
    score_data = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    exercise = relationship("Exercise", back_populates="expected_score")


class ReferenceThreshold(Base):
    __tablename__ = "reference_thresholds"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exercise_id = Column(UUID(as_uuid=True), ForeignKey("exercises.id"), nullable=False)
    version = Column(Integer, default=1)
    thresholds = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    exercise = relationship("Exercise", back_populates="reference_thresholds")
