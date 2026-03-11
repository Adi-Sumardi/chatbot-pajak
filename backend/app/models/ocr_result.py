import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import String, Integer, Text, Date, DateTime, Boolean, Numeric, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OCRResult(Base):
    __tablename__ = "ocr_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ocr_job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ocr_jobs.id", ondelete="CASCADE"), index=True)
    page_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    row_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tanggal: Mapped[date | None] = mapped_column(Date, nullable=True)
    keterangan: Mapped[str | None] = mapped_column(Text, nullable=True)
    debit: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    kredit: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    saldo: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_corrected: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    ocr_job = relationship("OCRJob", back_populates="results")
