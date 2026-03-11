import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OCRJob(Base):
    __tablename__ = "ocr_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    period_month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    period_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued, processing, completed, failed
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_pages: Mapped[int | None] = mapped_column(Integer, nullable=True)
    processed_pages: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    results = relationship("OCRResult", back_populates="ocr_job", cascade="all, delete-orphan")
