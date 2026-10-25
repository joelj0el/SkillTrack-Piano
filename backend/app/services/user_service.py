import uuid

from sqlalchemy import and_, delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import Institution, User, teacher_student
from app.schemas.auth import UserRegister
from app.schemas.user import InstitutionCreate, UserCreate, UserSummary
from app.services.auth_service import register_user


def to_summary(user: User) -> UserSummary:
    return UserSummary(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.name if user.role else None,
        institution_id=user.institution_id,
        is_active=user.is_active,
        created_at=user.created_at,
    )


async def get_user_with_role(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id).options(selectinload(User.role)))
    return result.scalar_one_or_none()


async def list_users(
    db: AsyncSession, role: str | None = None, institution_id: uuid.UUID | None = None
) -> list[UserSummary]:
    query = select(User).options(selectinload(User.role)).order_by(User.full_name)
    if institution_id:
        query = query.where(User.institution_id == institution_id)
    result = await db.execute(query)
    users = [to_summary(u) for u in result.scalars().all()]
    if role:
        users = [u for u in users if u.role == role]
    return users


async def create_user(db: AsyncSession, data: UserCreate) -> UserSummary:
    user = await register_user(db, UserRegister(**data.model_dump()))
    loaded = await get_user_with_role(db, user.id)
    return to_summary(loaded)


async def list_students_of_teacher(db: AsyncSession, teacher_id: uuid.UUID) -> list[UserSummary]:
    result = await db.execute(
        select(User)
        .join(teacher_student, teacher_student.c.student_id == User.id)
        .where(teacher_student.c.teacher_id == teacher_id)
        .options(selectinload(User.role))
        .order_by(User.full_name)
    )
    return [to_summary(u) for u in result.scalars().all()]


async def list_teachers_of_student(db: AsyncSession, student_id: uuid.UUID) -> list[UserSummary]:
    result = await db.execute(
        select(User)
        .join(teacher_student, teacher_student.c.teacher_id == User.id)
        .where(teacher_student.c.student_id == student_id)
        .options(selectinload(User.role))
        .order_by(User.full_name)
    )
    return [to_summary(u) for u in result.scalars().all()]


async def is_teacher_of(db: AsyncSession, teacher_id: uuid.UUID, student_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(teacher_student.c.student_id).where(
            and_(teacher_student.c.teacher_id == teacher_id, teacher_student.c.student_id == student_id)
        )
    )
    return result.first() is not None


async def link_student(db: AsyncSession, teacher_id: uuid.UUID, student_id: uuid.UUID) -> None:
    if await is_teacher_of(db, teacher_id, student_id):
        return
    await db.execute(insert(teacher_student).values(teacher_id=teacher_id, student_id=student_id))
    await db.commit()


async def unlink_student(db: AsyncSession, teacher_id: uuid.UUID, student_id: uuid.UUID) -> None:
    await db.execute(
        delete(teacher_student).where(
            and_(teacher_student.c.teacher_id == teacher_id, teacher_student.c.student_id == student_id)
        )
    )
    await db.commit()


async def list_institutions(db: AsyncSession) -> list[Institution]:
    result = await db.execute(select(Institution).order_by(Institution.name))
    return list(result.scalars().all())


async def create_institution(db: AsyncSession, data: InstitutionCreate) -> Institution:
    institution = Institution(**data.model_dump())
    db.add(institution)
    await db.commit()
    await db.refresh(institution)
    return institution
