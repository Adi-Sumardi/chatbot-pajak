"""Tests for admin endpoints."""

import pytest
from httpx import AsyncClient

from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
class TestAdminAccess:
    async def test_staff_cannot_access_admin(self, client: AsyncClient, staff_user: User):
        res = await client.get("/api/v1/admin/users", headers=auth_header(staff_user))
        assert res.status_code == 403

    async def test_staff_cannot_access_stats(self, client: AsyncClient, staff_user: User):
        res = await client.get("/api/v1/admin/stats", headers=auth_header(staff_user))
        assert res.status_code == 403

    async def test_no_auth_returns_error(self, client: AsyncClient):
        res = await client.get("/api/v1/admin/users")
        assert res.status_code in (401, 403)


@pytest.mark.asyncio
class TestAdminStats:
    async def test_get_stats(self, client: AsyncClient, superadmin_user: User):
        res = await client.get("/api/v1/admin/stats", headers=auth_header(superadmin_user))
        assert res.status_code == 200
        data = res.json()
        assert "total_users" in data
        assert "active_users" in data
        assert "total_conversations" in data
        assert "total_scans" in data


@pytest.mark.asyncio
class TestAdminUserCRUD:
    async def test_list_users(self, client: AsyncClient, superadmin_user: User):
        res = await client.get("/api/v1/admin/users", headers=auth_header(superadmin_user))
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_create_user(self, client: AsyncClient, superadmin_user: User):
        res = await client.post("/api/v1/admin/users", headers=auth_header(superadmin_user), json={
            "email": "created@test.com",
            "password": "Pass1234!",
            "full_name": "Created User",
            "role": "staff",
        })
        assert res.status_code == 201
        assert res.json()["email"] == "created@test.com"
        assert res.json()["role"] == "staff"

    async def test_create_user_duplicate_email(self, client: AsyncClient, superadmin_user: User, staff_user: User):
        res = await client.post("/api/v1/admin/users", headers=auth_header(superadmin_user), json={
            "email": staff_user.email,
            "password": "Pass1234!",
            "full_name": "Duplicate",
        })
        assert res.status_code == 400

    async def test_update_user(self, client: AsyncClient, superadmin_user: User, staff_user: User):
        res = await client.patch(
            f"/api/v1/admin/users/{staff_user.id}",
            headers=auth_header(superadmin_user),
            json={"full_name": "Updated Staff"},
        )
        assert res.status_code == 200
        assert res.json()["full_name"] == "Updated Staff"

    async def test_toggle_user_active(self, client: AsyncClient, superadmin_user: User, staff_user: User):
        res = await client.patch(
            f"/api/v1/admin/users/{staff_user.id}",
            headers=auth_header(superadmin_user),
            json={"is_active": False},
        )
        assert res.status_code == 200
        assert res.json()["is_active"] is False

    async def test_cannot_deactivate_self(self, client: AsyncClient, superadmin_user: User):
        res = await client.patch(
            f"/api/v1/admin/users/{superadmin_user.id}",
            headers=auth_header(superadmin_user),
            json={"is_active": False},
        )
        assert res.status_code == 400

    async def test_cannot_change_own_role(self, client: AsyncClient, superadmin_user: User):
        res = await client.patch(
            f"/api/v1/admin/users/{superadmin_user.id}",
            headers=auth_header(superadmin_user),
            json={"role": "staff"},
        )
        assert res.status_code == 400

    async def test_delete_user(self, client: AsyncClient, superadmin_user: User, staff_user: User):
        res = await client.delete(
            f"/api/v1/admin/users/{staff_user.id}",
            headers=auth_header(superadmin_user),
        )
        assert res.status_code == 204

    async def test_cannot_delete_self(self, client: AsyncClient, superadmin_user: User):
        res = await client.delete(
            f"/api/v1/admin/users/{superadmin_user.id}",
            headers=auth_header(superadmin_user),
        )
        assert res.status_code == 400

    async def test_delete_nonexistent_user(self, client: AsyncClient, superadmin_user: User):
        import uuid
        res = await client.delete(
            f"/api/v1/admin/users/{uuid.uuid4()}",
            headers=auth_header(superadmin_user),
        )
        assert res.status_code == 404


@pytest.mark.asyncio
class TestAdminSecurity:
    """Test that admin endpoints prevent IDOR and privilege escalation."""

    async def test_staff_cannot_create_superadmin(self, client: AsyncClient, staff_user: User):
        res = await client.post("/api/v1/admin/users", headers=auth_header(staff_user), json={
            "email": "hacker@test.com",
            "password": "Pass1234!",
            "full_name": "Hacker",
            "role": "superadmin",
        })
        assert res.status_code == 403

    async def test_staff_cannot_delete_users(self, client: AsyncClient, staff_user: User, superadmin_user: User):
        res = await client.delete(
            f"/api/v1/admin/users/{superadmin_user.id}",
            headers=auth_header(staff_user),
        )
        assert res.status_code == 403
