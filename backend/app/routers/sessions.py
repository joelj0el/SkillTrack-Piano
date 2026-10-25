import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.session import SessionCreate, SessionMetricOut, SessionOut, SessionResult
from app.services import session_service, user_service

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def create_session(data: SessionCreate, db: AsyncSession = Depends(get_db)):
    return await session_service.create_session(db, data)


@router.post("/{session_id}/result", response_model=SessionMetricOut, status_code=status.HTTP_201_CREATED)
async def submit_session_result(
    session_id: uuid.UUID, result: SessionResult, db: AsyncSession = Depends(get_db)
):
    if result.sessionId != session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="sessionId no coincide con la URL"
        )
    try:
        return await session_service.save_session_result(db, session_id, result)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/student/{student_id}", response_model=list[SessionOut])
async def get_student_sessions(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.id != student_id and not await user_service.is_teacher_of(db, current_user.id, student_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    return await session_service.get_student_history(db, student_id)
