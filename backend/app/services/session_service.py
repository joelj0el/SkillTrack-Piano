import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import PracticeSession, SessionMetric
from app.schemas.session import SessionCreate, SessionResult


async def create_session(db: AsyncSession, data: SessionCreate) -> PracticeSession:
    session = PracticeSession(
        student_id=data.student_id,
        exercise_id=data.exercise_id,
        started_at=datetime.now(timezone.utc),
        status="recording",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def save_session_result(
    db: AsyncSession, session_id: uuid.UUID, result: SessionResult
) -> SessionMetric:
    session_query = await db.execute(select(PracticeSession).where(PracticeSession.id == session_id))
    session = session_query.scalar_one_or_none()
    if session is None:
        raise ValueError("Sesión no encontrada")

    session.ended_at = result.endedAt
    session.status = "completed"
    session.reference_threshold_version = result.referenceThresholdVersion

    metric = SessionMetric(
        session_id=session_id,
        raw_result=result.model_dump(mode="json"),
        vision_errors=[e.model_dump(mode="json") for e in result.visionErrors],
        audio_events=[e.model_dump(mode="json") for e in result.audioEvents],
        fusion_events=[e.model_dump(mode="json") for e in result.fusionEvents],
        feedback_summary=[f.model_dump(mode="json") for f in result.feedbackSummary],
        overall_score=result.overallScore,
    )
    db.add(metric)
    await db.commit()
    await db.refresh(metric)
    return metric


async def get_student_history(db: AsyncSession, student_id: uuid.UUID) -> list[PracticeSession]:
    result = await db.execute(
        select(PracticeSession)
        .where(PracticeSession.student_id == student_id)
        .order_by(PracticeSession.created_at.desc())
    )
    return list(result.scalars().all())
