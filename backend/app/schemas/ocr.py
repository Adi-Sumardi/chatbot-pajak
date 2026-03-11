import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class OCRScanRequest(BaseModel):
    bank_name: str | None = None
    period_month: int | None = None
    period_year: int | None = None


class OCRJobResponse(BaseModel):
    id: uuid.UUID
    bank_name: str | None
    period_month: int | None
    period_year: int | None
    status: str
    error_message: str | None
    total_pages: int | None
    processed_pages: int
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class OCRResultResponse(BaseModel):
    id: uuid.UUID
    page_number: int | None
    row_number: int | None
    tanggal: date | None
    keterangan: str | None
    debit: Decimal | None
    kredit: Decimal | None
    saldo: Decimal | None
    is_corrected: bool

    model_config = {"from_attributes": True}


class OCRResultUpdate(BaseModel):
    tanggal: date | None = None
    keterangan: str | None = None
    debit: Decimal | None = None
    kredit: Decimal | None = None
    saldo: Decimal | None = None
