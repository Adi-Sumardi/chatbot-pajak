import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserListResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    kantor_pajak: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "staff"
    kantor_pajak: str | None = None


class AdminUserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    role: str | None = None
    kantor_pajak: str | None = None
    is_active: bool | None = None
    password: str | None = None


class DashboardStats(BaseModel):
    total_users: int
    active_users: int
    total_conversations: int
    total_scans: int
