import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base

teacher_student = Table(
    "teacher_student",
    Base.metadata,
    Column("teacher_id", UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True),
    Column("student_id", UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True),
    Column("created_at", DateTime(timezone=True), server_default=func.now()),
)


class Institution(Base):
    __tablename__ = "institutions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    city = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    users = relationship("User", back_populates="institution")


class Role(Base):
    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), unique=True, nullable=False)

    users = relationship("User", back_populates="role")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String(255))
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"))
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    role = relationship("Role", back_populates="users")
    institution = relationship("Institution", back_populates="users")

    students = relationship(
        "User",
        secondary=teacher_student,
        primaryjoin=id == teacher_student.c.teacher_id,
        secondaryjoin=id == teacher_student.c.student_id,
        backref="teachers",
    )
