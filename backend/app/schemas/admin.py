import uuid
from datetime import datetime

from typing import Literal

from pydantic import BaseModel, EmailStr, Field

VALID_ROLES = Literal["staff", "admin", "superadmin"]


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
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=1, max_length=100)
    role: VALID_ROLES = "staff"
    kantor_pajak: str | None = Field(None, max_length=100)


class AdminUserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = Field(None, max_length=100)
    role: VALID_ROLES | None = None
    kantor_pajak: str | None = Field(None, max_length=100)
    is_active: bool | None = None
    password: str | None = Field(None, min_length=6)


class DashboardStats(BaseModel):
    total_users: int
    active_users: int
    total_conversations: int
    total_scans: int
