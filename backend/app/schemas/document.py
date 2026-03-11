import uuid
from datetime import datetime

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: uuid.UUID
    file_name: str
    file_size: int | None
    mime_type: str | None
    doc_type: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentDetail(DocumentResponse):
    extracted_text: str | None
    metadata_: dict = {}
