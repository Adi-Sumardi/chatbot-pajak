import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db, async_session
from app.dependencies import get_current_user
from app.models.user import User
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.document import Document, ConversationDocument
from app.schemas.chat import (
    ConversationCreate,
    ConversationUpdate,
    ConversationResponse,
    ConversationDetail,
    MessageCreate,
    MessageResponse,
    AttachDocumentRequest,
)
from app.services.ai_service import build_messages, stream_chat, generate_title

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    data: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = Conversation(
        user_id=current_user.id,
        title=data.title,
        ai_model=data.ai_model,
    )
    db.add(conversation)
    await db.flush()
    return conversation


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    archived: bool = False,
    search: str | None = None,
):
    query = (
        select(Conversation)
        .where(Conversation.user_id == current_user.id, Conversation.is_archived == archived)
    )
    if search:
        query = query.where(Conversation.title.ilike(f"%{search}%"))
    query = query.order_by(Conversation.updated_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.patch("/conversations/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: uuid.UUID,
    data: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    if data.title is not None:
        conversation.title = data.title
    if data.is_archived is not None:
        conversation.is_archived = data.is_archived
    return conversation


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conversation


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    await db.delete(conversation)


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: uuid.UUID,
    data: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Get conversation with messages and documents
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages), selectinload(Conversation.documents))
        .where(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    # Save user message and commit immediately
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=data.content,
    )
    db.add(user_message)

    # Build context from attached documents
    attached_text = None
    if conversation.documents:
        doc_texts = []
        for doc in conversation.documents:
            if doc.extracted_text:
                doc_texts.append(f"### {doc.file_name} ({doc.doc_type or 'dokumen'}):\n{doc.extracted_text}")
        if doc_texts:
            attached_text = "\n\n".join(doc_texts)

    # Build messages for AI
    history = [{"role": m.role, "content": m.content} for m in conversation.messages]
    history.append({"role": "user", "content": data.content})

    ai_model = data.ai_model or conversation.ai_model
    system_prompt, messages = build_messages(history, attached_text, conversation.system_prompt)

    # Auto-generate title on first message
    is_first_message = len(conversation.messages) == 0
    if is_first_message and not conversation.title:
        try:
            title = await generate_title(data.content, ai_model)
            conversation.title = title
        except Exception:
            conversation.title = data.content[:50]

    # Commit user message + title before streaming
    await db.commit()

    # Capture IDs for use in the generator (session will be closed)
    conv_id = conversation.id
    user_id = current_user.id
    user_content = data.content
    conv_title = conversation.title or "Laporan Chatbot Pajak"

    # Stream response using a separate DB session
    async def event_stream():
        full_response = ""
        try:
            import json as json_mod
            async for chunk in stream_chat(messages, system_prompt, ai_model):
                full_response += chunk
                yield f"data: {json_mod.dumps(chunk)}\n\n"

            yield "data: [DONE]\n\n"

            # Save assistant message with a new session
            async with async_session() as save_db:
                assistant_message = Message(
                    conversation_id=conv_id,
                    role="assistant",
                    content=full_response,
                    ai_model=ai_model,
                )
                save_db.add(assistant_message)
                await save_db.commit()

                # Check if user asked for Excel/PDF file
                msg_id = str(assistant_message.id)

            file_keywords = ["excel", "xlsx", "spreadsheet", "pdf", "file", "unduh", "download", "ekspor", "export"]
            user_lower = user_content.lower()
            wants_file = any(k in user_lower for k in file_keywords)

            if wants_file and len(full_response) > 100:
                from pathlib import Path
                from app.services.export_service import export_chat_to_excel, export_chat_to_pdf
                from app.config import get_settings
                import asyncio

                settings = get_settings()
                export_dir = Path(settings.EXPORT_DIR) / str(user_id)
                export_dir.mkdir(parents=True, exist_ok=True)

                files = []

                # Detect which format(s) user wants
                wants_excel = any(k in user_lower for k in ["excel", "xlsx", "spreadsheet"])
                wants_pdf = any(k in user_lower for k in ["pdf"])
                # If generic "file/download/export", generate both
                if not wants_excel and not wants_pdf:
                    wants_excel = True
                    wants_pdf = True

                if wants_excel:
                    try:
                        path = str(export_dir / f"chat_{msg_id}.xlsx")
                        await asyncio.to_thread(export_chat_to_excel, full_response, path, conv_title)
                        files.append({"format": "excel", "message_id": msg_id})
                    except Exception as e:
                        import logging
                        logging.getLogger(__name__).error(f"Excel export failed: {e}")

                if wants_pdf:
                    try:
                        path = str(export_dir / f"chat_{msg_id}.pdf")
                        await asyncio.to_thread(export_chat_to_pdf, full_response, path, conv_title)
                        files.append({"format": "pdf", "message_id": msg_id})
                    except Exception as e:
                        import logging
                        logging.getLogger(__name__).error(f"PDF export failed: {e}")

                if files:
                    yield f"data: {json_mod.dumps({'type': 'files', 'files': files})}\n\n"

        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Chat streaming error: {e}")
            yield f"data: [ERROR] Terjadi kesalahan saat memproses permintaan.\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/conversations/{conversation_id}/attach", status_code=status.HTTP_200_OK)
async def attach_document(
    conversation_id: uuid.UUID,
    data: AttachDocumentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify conversation belongs to user
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    # Verify document belongs to user
    result = await db.execute(
        select(Document).where(Document.id == data.document_id, Document.user_id == current_user.id)
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Check if already attached
    result = await db.execute(
        select(ConversationDocument).where(
            ConversationDocument.conversation_id == conversation_id,
            ConversationDocument.document_id == data.document_id,
        )
    )
    if result.scalar_one_or_none():
        return {"message": "Document already attached"}

    link = ConversationDocument(conversation_id=conversation_id, document_id=data.document_id)
    db.add(link)
    return {"message": "Document attached successfully"}


@router.get("/messages/{message_id}/export")
async def export_message(
    message_id: uuid.UUID,
    format: str = "excel",
    token: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Export an assistant message to Excel or PDF. Token via query param for browser download."""
    from pathlib import Path
    from fastapi.responses import FileResponse
    from app.services.auth_service import decode_token, get_user_by_id
    from app.services.export_service import export_chat_to_excel, export_chat_to_pdf
    from app.config import get_settings

    settings = get_settings()

    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token required")

    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = await get_user_by_id(db, payload.get("sub", ""))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Get message and verify it belongs to user's conversation
    result = await db.execute(
        select(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(Message.id == message_id, Conversation.user_id == user.id)
    )
    message = result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    if message.role != "assistant":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Hanya bisa export pesan assistant")

    # Get conversation title for the export
    conv_result = await db.execute(
        select(Conversation).where(Conversation.id == message.conversation_id)
    )
    conv = conv_result.scalar_one_or_none()
    title = conv.title or "Laporan Chatbot Pajak" if conv else "Laporan Chatbot Pajak"

    export_dir = Path(settings.EXPORT_DIR) / str(user.id)
    export_dir.mkdir(parents=True, exist_ok=True)

    import re
    safe_title = re.sub(r'[^\w\s-]', '', title)[:100].strip() or "Laporan"

    if format == "pdf":
        output_path = str(export_dir / f"chat_export_{message_id}.pdf")
        export_chat_to_pdf(message.content, output_path, title)
        return FileResponse(
            output_path,
            media_type="application/pdf",
            filename=f"{safe_title}.pdf",
        )
    else:
        output_path = str(export_dir / f"chat_export_{message_id}.xlsx")
        export_chat_to_excel(message.content, output_path, title)
        return FileResponse(
            output_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=f"{safe_title}.xlsx",
        )
