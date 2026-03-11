import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_admin_user
from app.models.user import User
from app.models.conversation import Conversation
from app.models.ocr_job import OCRJob
from app.schemas.admin import UserListResponse, AdminUserCreate, AdminUserUpdate, DashboardStats
from app.services.auth_service import hash_password

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Get dashboard statistics."""
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    active_users = (await db.execute(
        select(func.count(User.id)).where(User.is_active == True)
    )).scalar() or 0
    total_conversations = (await db.execute(select(func.count(Conversation.id)))).scalar() or 0
    total_scans = (await db.execute(select(func.count(OCRJob.id)))).scalar() or 0

    return DashboardStats(
        total_users=total_users,
        active_users=active_users,
        total_conversations=total_conversations,
        total_scans=total_scans,
    )


@router.get("/users", response_model=list[UserListResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """List all users."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()


@router.post("/users", response_model=UserListResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: AdminUserCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Create a new user (admin only)."""
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email sudah terdaftar.",
        )

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        role=data.role,
        kantor_pajak=data.kantor_pajak,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user


@router.patch("/users/{user_id}", response_model=UserListResponse)
async def update_user(
    user_id: uuid.UUID,
    data: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Update a user (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Prevent demoting yourself
    if user.id == admin.id and data.role and data.role != admin.role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tidak bisa mengubah role sendiri.",
        )

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.email is not None:
        # Check uniqueness
        existing = await db.execute(select(User).where(User.email == data.email, User.id != user_id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email sudah digunakan.")
        user.email = data.email
    if data.role is not None:
        user.role = data.role
    if data.kantor_pajak is not None:
        user.kantor_pajak = data.kantor_pajak
    if data.is_active is not None:
        if user.id == admin.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak bisa menonaktifkan akun sendiri.",
            )
        user.is_active = data.is_active
    if data.password:
        user.password_hash = hash_password(data.password)

    await db.flush()
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Delete a user (admin only)."""
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tidak bisa menghapus akun sendiri.",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await db.delete(user)
