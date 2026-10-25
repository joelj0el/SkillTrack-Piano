import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class InstitutionCreate(BaseModel):
    name: str
    city: str | None = None


class InstitutionOut(BaseModel):
    id: uuid.UUID
    name: str
    city: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str
    institution_id: uuid.UUID | None = None


class UserSummary(BaseModel):
    """Usuario con el nombre de rol ya resuelto (no expone el hash de contraseña)."""

    id: uuid.UUID
    email: EmailStr
    full_name: str | None
    role: str | None
    institution_id: uuid.UUID | None
    is_active: bool
    created_at: datetime | None = None
