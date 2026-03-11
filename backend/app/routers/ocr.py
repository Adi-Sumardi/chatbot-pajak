import uuid
import logging
from datetime import datetime
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.ocr_job import OCRJob
from app.models.ocr_result import OCRResult
from app.schemas.ocr import OCRJobResponse, OCRResultResponse, OCRResultUpdate
from app.services.ocr_service import process_pdf, get_total_pages, export_to_excel, detect_bank_from_pdf

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(prefix="/ocr", tags=["OCR Scanner"])


@router.post("/scan", response_model=OCRJobResponse, status_code=status.HTTP_201_CREATED)
async def scan_document(
    file: UploadFile = File(...),
    bank_name: str | None = Form(None),
    period_year: int | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a PDF bank statement and extract transactions via OCR."""
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hanya file PDF yang diperbolehkan.",
        )

    content = await file.read()
    max_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File terlalu besar. Maksimum: {settings.MAX_UPLOAD_SIZE_MB}MB",
        )

    # Save file
    user_dir = Path(settings.UPLOAD_DIR) / str(current_user.id) / "ocr"
    user_dir.mkdir(parents=True, exist_ok=True)
    saved_name = f"{uuid.uuid4()}.pdf"
    file_path = user_dir / saved_name

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    # Auto-detect bank if not provided
    if not bank_name:
        detected = await _run_in_thread(detect_bank_from_pdf, str(file_path))
        bank_name = detected or "other"

    # Save document record
    document = Document(
        user_id=current_user.id,
        file_name=file.filename or saved_name,
        file_path=str(file_path),
        file_size=len(content),
        mime_type="application/pdf",
        doc_type="rekening_koran",
    )
    db.add(document)
    await db.flush()

    # Create OCR job
    ocr_job = OCRJob(
        user_id=current_user.id,
        document_id=document.id,
        bank_name=bank_name,
        period_year=period_year,
        status="processing",
    )
    db.add(ocr_job)
    await db.flush()

    # Process PDF (extract tables)
    try:
        total_pages = await _run_in_thread(get_total_pages, str(file_path))
        ocr_job.total_pages = total_pages

        rows = await process_pdf(str(file_path), bank_name, period_year)

        for row in rows:
            result = OCRResult(
                ocr_job_id=ocr_job.id,
                row_number=row["row_number"],
                tanggal=row.get("tanggal"),
                keterangan=row.get("keterangan"),
                debit=row.get("debit"),
                kredit=row.get("kredit"),
                saldo=row.get("saldo"),
                raw_text=row.get("raw_text"),
            )
            db.add(result)

        ocr_job.processed_pages = total_pages
        ocr_job.status = "completed"
        ocr_job.completed_at = datetime.utcnow()
    except Exception as e:
        logger.error(f"OCR processing failed: {e}", exc_info=True)
        ocr_job.status = "failed"
        ocr_job.error_message = "Gagal memproses file PDF. Pastikan file tidak corrupt."

    await db.flush()
    return ocr_job


async def _run_in_thread(fn, *args):
    import asyncio
    return await asyncio.to_thread(fn, *args)


@router.get("/jobs", response_model=list[OCRJobResponse])
async def list_ocr_jobs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all OCR jobs for the current user."""
    result = await db.execute(
        select(OCRJob)
        .where(OCRJob.user_id == current_user.id)
        .order_by(OCRJob.created_at.desc())
    )
    return result.scalars().all()


@router.get("/jobs/{job_id}", response_model=OCRJobResponse)
async def get_ocr_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get OCR job details."""
    result = await db.execute(
        select(OCRJob).where(OCRJob.id == job_id, OCRJob.user_id == current_user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


@router.get("/jobs/{job_id}/results", response_model=list[OCRResultResponse])
async def get_ocr_results(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get OCR extraction results for a job."""
    # Verify job belongs to user
    job_result = await db.execute(
        select(OCRJob).where(OCRJob.id == job_id, OCRJob.user_id == current_user.id)
    )
    if not job_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    result = await db.execute(
        select(OCRResult)
        .where(OCRResult.ocr_job_id == job_id)
        .order_by(OCRResult.row_number)
    )
    return result.scalars().all()


@router.patch("/results/{result_id}", response_model=OCRResultResponse)
async def update_ocr_result(
    result_id: uuid.UUID,
    data: OCRResultUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update/correct an OCR result row."""
    result = await db.execute(
        select(OCRResult)
        .join(OCRJob, OCRResult.ocr_job_id == OCRJob.id)
        .where(OCRResult.id == result_id, OCRJob.user_id == current_user.id)
    )
    ocr_result = result.scalar_one_or_none()
    if not ocr_result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result not found")

    if data.tanggal is not None:
        ocr_result.tanggal = data.tanggal
    if data.keterangan is not None:
        ocr_result.keterangan = data.keterangan
    if data.debit is not None:
        ocr_result.debit = data.debit
    if data.kredit is not None:
        ocr_result.kredit = data.kredit
    if data.saldo is not None:
        ocr_result.saldo = data.saldo
    ocr_result.is_corrected = True

    return ocr_result


@router.get("/jobs/{job_id}/export")
async def export_ocr_to_excel(
    job_id: uuid.UUID,
    token: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Export OCR results to Excel file. Accepts token via query param for browser download."""
    from app.services.auth_service import decode_token, get_user_by_id

    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token required")

    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = await get_user_by_id(db, payload.get("sub", ""))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Get job
    job_result = await db.execute(
        select(OCRJob).where(OCRJob.id == job_id, OCRJob.user_id == user.id)
    )
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    if job.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job belum selesai diproses.",
        )

    # Get results
    result = await db.execute(
        select(OCRResult)
        .where(OCRResult.ocr_job_id == job_id)
        .order_by(OCRResult.row_number)
    )
    results = result.scalars().all()

    if not results:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tidak ada data untuk diekspor.",
        )

    # Convert to dict list
    rows = [
        {
            "tanggal": r.tanggal,
            "keterangan": r.keterangan,
            "debit": r.debit,
            "kredit": r.kredit,
            "saldo": r.saldo,
        }
        for r in results
    ]

    # Export - sanitize bank_name to prevent path traversal
    import re
    safe_bank = re.sub(r'[^a-zA-Z0-9_-]', '', job.bank_name or 'bank')
    export_dir = Path(settings.EXPORT_DIR) / str(user.id)
    export_dir.mkdir(parents=True, exist_ok=True)
    export_path = str(export_dir / f"rekening_koran_{safe_bank}_{job_id}.xlsx")

    await _run_in_thread(export_to_excel, rows, export_path, job.bank_name)

    return FileResponse(
        export_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"Rekening_Koran_{(job.bank_name or 'Bank').upper()}.xlsx",
    )


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ocr_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an OCR job and its results."""
    result = await db.execute(
        select(OCRJob).where(OCRJob.id == job_id, OCRJob.user_id == current_user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    await db.delete(job)
