"""Tests for chat endpoints."""

import pytest
import uuid
from httpx import AsyncClient

from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
class TestConversations:
    async def test_create_conversation(self, client: AsyncClient, staff_user: User):
        res = await client.post("/api/v1/chat/conversations", headers=auth_header(staff_user), json={
            "ai_model": "claude",
        })
        assert res.status_code == 201
        data = res.json()
        assert data["ai_model"] == "claude"
        assert data["is_archived"] is False

    async def test_list_conversations(self, client: AsyncClient, staff_user: User):
        # Create one first
        await client.post("/api/v1/chat/conversations", headers=auth_header(staff_user), json={
            "ai_model": "claude",
        })
        res = await client.get("/api/v1/chat/conversations", headers=auth_header(staff_user))
        assert res.status_code == 200
        assert isinstance(res.json(), list)
        assert len(res.json()) >= 1

    async def test_get_conversation(self, client: AsyncClient, staff_user: User):
        create_res = await client.post("/api/v1/chat/conversations", headers=auth_header(staff_user), json={
            "ai_model": "claude",
        })
        conv_id = create_res.json()["id"]

        res = await client.get(f"/api/v1/chat/conversations/{conv_id}", headers=auth_header(staff_user))
        assert res.status_code == 200
        assert res.json()["id"] == conv_id

    async def test_get_nonexistent_conversation(self, client: AsyncClient, staff_user: User):
        res = await client.get(
            f"/api/v1/chat/conversations/{uuid.uuid4()}",
            headers=auth_header(staff_user),
        )
        assert res.status_code == 404

    async def test_delete_conversation(self, client: AsyncClient, staff_user: User):
        create_res = await client.post("/api/v1/chat/conversations", headers=auth_header(staff_user), json={
            "ai_model": "claude",
        })
        conv_id = create_res.json()["id"]

        res = await client.delete(f"/api/v1/chat/conversations/{conv_id}", headers=auth_header(staff_user))
        assert res.status_code == 204

    async def test_archive_conversation(self, client: AsyncClient, staff_user: User):
        create_res = await client.post("/api/v1/chat/conversations", headers=auth_header(staff_user), json={
            "ai_model": "claude",
        })
        conv_id = create_res.json()["id"]

        res = await client.patch(
            f"/api/v1/chat/conversations/{conv_id}",
            headers=auth_header(staff_user),
            json={"is_archived": True},
        )
        assert res.status_code == 200
        assert res.json()["is_archived"] is True


@pytest.mark.asyncio
class TestConversationIsolation:
    """Test that users cannot access other users' conversations."""

    async def test_user_cannot_see_other_conversations(
        self, client: AsyncClient, staff_user: User, superadmin_user: User,
    ):
        # Staff creates a conversation
        create_res = await client.post("/api/v1/chat/conversations", headers=auth_header(staff_user), json={
            "ai_model": "claude",
        })
        conv_id = create_res.json()["id"]

        # Admin tries to access it
        res = await client.get(
            f"/api/v1/chat/conversations/{conv_id}",
            headers=auth_header(superadmin_user),
        )
        assert res.status_code == 404

    async def test_user_cannot_delete_other_conversations(
        self, client: AsyncClient, staff_user: User, superadmin_user: User,
    ):
        create_res = await client.post("/api/v1/chat/conversations", headers=auth_header(staff_user), json={
            "ai_model": "claude",
        })
        conv_id = create_res.json()["id"]

        res = await client.delete(
            f"/api/v1/chat/conversations/{conv_id}",
            headers=auth_header(superadmin_user),
        )
        assert res.status_code == 404


@pytest.mark.asyncio
class TestChatNoAuth:
    async def test_conversations_require_auth(self, client: AsyncClient):
        res = await client.get("/api/v1/chat/conversations")
        assert res.status_code in (401, 403)

    async def test_create_conversation_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/chat/conversations", json={"ai_model": "claude"})
        assert res.status_code in (401, 403)
