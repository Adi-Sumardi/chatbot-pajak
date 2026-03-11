import os
import uuid
import logging
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from app.config import get_settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.document import Document
from app.models.user import User
from app.schemas.document import DocumentResponse, DocumentDetail

settings = get_settings()
router = APIRouter(prefix="/documents", tags=["Documents"])

ALLOWED_TYPES = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel": "xls",
}

DOC_TYPE_KEYWORDS = {
    "faktur": "faktur_pajak",
    "fp-": "faktur_pajak",
    "e-faktur": "faktur_pajak",
    "bupot": "bukti_potong",
    "bukti potong": "bukti_potong",
    "bp-": "bukti_potong",
    "rekening koran": "rekening_koran",
    "rek koran": "rekening_koran",
    "bank statement": "rekening_koran",
    "spt": "spt",
}


async def extract_text_from_pdf(file_path: str) -> str | None:
    """Extract text from a PDF file using PyPDF2."""
    try:
        import PyPDF2
        import asyncio

        def _extract():
            text_parts = []
            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text.strip())
            return "\n\n".join(text_parts) if text_parts else None

        return await asyncio.to_thread(_extract)
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        return None


def classify_document(filename: str) -> str:
    lower = filename.lower()
    for keyword, doc_type in DOC_TYPE_KEYWORDS.items():
        if keyword in lower:
            return doc_type
    return "other"


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_TYPES.values())}",
        )

    # Validate file size
    content = await file.read()
    max_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum: {settings.MAX_UPLOAD_SIZE_MB}MB",
        )

    # Save file
    user_dir = Path(settings.UPLOAD_DIR) / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)

    file_ext = ALLOWED_TYPES[file.content_type]
    saved_name = f"{uuid.uuid4()}.{file_ext}"
    file_path = user_dir / saved_name

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    # Classify document
    doc_type = classify_document(file.filename or "")

    # Create DB record
    document = Document(
        user_id=current_user.id,
        file_name=file.filename or saved_name,
        file_path=str(file_path),
        file_size=len(content),
        mime_type=file.content_type,
        doc_type=doc_type,
    )
    db.add(document)
    await db.flush()

    # Extract text from PDF
    if file.content_type == "application/pdf":
        try:
            extracted = await extract_text_from_pdf(str(file_path))
            if extracted:
                document.extracted_text = extracted
        except Exception as e:
            logger.warning(f"PDF text extraction failed for {file.filename}: {e}")

    return document


@router.get("/", response_model=list[DocumentResponse])
async def list_documents(
    doc_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Document).where(Document.user_id == current_user.id)
    if doc_type:
        query = query.where(Document.doc_type == doc_type)
    query = query.order_by(Document.created_at.desc())

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{document_id}", response_model=DocumentDetail)
async def get_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Delete file from disk
    if os.path.exists(document.file_path):
        os.remove(document.file_path)

    await db.delete(document)


@router.get("/{document_id}/file")
async def serve_document_file(
    document_id: uuid.UUID,
    token: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    # Support token via query param for browser window.open
    from app.services.auth_service import decode_token, get_user_by_id

    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token required")

    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = await get_user_by_id(db, payload.get("sub", ""))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == user.id)
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if not os.path.exists(document.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")
    return FileResponse(
        document.file_path,
        media_type=document.mime_type,
        filename=document.file_name,
    )
