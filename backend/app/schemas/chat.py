import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ConversationCreate(BaseModel):
    title: str | None = Field(None, max_length=255)
    ai_model: str = "openai"  # 'openai' or 'claude'


class ConversationResponse(BaseModel):
    id: uuid.UUID
    title: str | None
    ai_model: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConversationDetail(ConversationResponse):
    messages: list["MessageResponse"] = []


class MessageCreate(BaseModel):
    content: str
    ai_model: str | None = None  # override conversation default


class MessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    ai_model: str | None
    token_usage: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationUpdate(BaseModel):
    title: str | None = Field(None, max_length=255)
    is_archived: bool | None = None


class AttachDocumentRequest(BaseModel):
    document_id: uuid.UUID
