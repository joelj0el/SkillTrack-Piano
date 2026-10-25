import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_current_user_role
from app.database import get_db
from app.models.user import User
from app.schemas.user import InstitutionCreate, InstitutionOut, UserCreate, UserSummary
from app.services import user_service

router = APIRouter(tags=["users"])

ADMIN_ROLES = ("admin", "institution_admin")


def require_admin(role: str = Depends(get_current_user_role)) -> str:
    if role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    return role


@router.get("/users/me/students", response_model=list[UserSummary])
async def my_students(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    role: str = Depends(get_current_user_role),
):
    if role != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo para docentes")
    return await user_service.list_students_of_teacher(db, current_user.id)


@router.get("/users/me/teachers", response_model=list[UserSummary])
async def my_teachers(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    return await user_service.list_teachers_of_student(db, current_user.id)


@router.get("/users/{user_id}", response_model=UserSummary)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    role: str = Depends(get_current_user_role),
):
    allowed = (
        user_id == current_user.id
        or role in ADMIN_ROLES
        or await user_service.is_teacher_of(db, current_user.id, user_id)
        or await user_service.is_teacher_of(db, user_id, current_user.id)
    )
    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    user = await user_service.get_user_with_role(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return user_service.to_summary(user)


@router.get("/users", response_model=list[UserSummary], dependencies=[Depends(require_admin)])
async def list_users(
    role: str | None = None, institution_id: uuid.UUID | None = None, db: AsyncSession = Depends(get_db)
):
    return await user_service.list_users(db, role=role, institution_id=institution_id)


@router.post(
    "/users",
    response_model=UserSummary,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def create_user(data: UserCreate, db: AsyncSession = Depends(get_db), role: str = Depends(require_admin)):
    if role == "institution_admin" and data.role not in ("student", "teacher"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo puedes crear docentes y estudiantes")
    try:
        return await user_service.create_user(db, data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post(
    "/users/{teacher_id}/students/{student_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
async def link_student(teacher_id: uuid.UUID, student_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await user_service.link_student(db, teacher_id, student_id)


@router.delete(
    "/users/{teacher_id}/students/{student_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
async def unlink_student(teacher_id: uuid.UUID, student_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await user_service.unlink_student(db, teacher_id, student_id)


@router.get("/users/{teacher_id}/students", response_model=list[UserSummary], dependencies=[Depends(require_admin)])
async def students_of_teacher(teacher_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await user_service.list_students_of_teacher(db, teacher_id)


@router.get("/institutions", response_model=list[InstitutionOut])
async def list_institutions(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await user_service.list_institutions(db)


@router.post(
    "/institutions",
    response_model=InstitutionOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def create_institution(data: InstitutionCreate, db: AsyncSession = Depends(get_db)):
    return await user_service.create_institution(db, data)
