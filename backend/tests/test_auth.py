"""Tests for authentication endpoints."""

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
class TestRegister:
    async def test_register_success(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/register", json={
            "email": "newuser@test.com",
            "password": "Pass1234!",
            "full_name": "New User",
            "kantor_pajak": "KPP Test",
        })
        assert res.status_code == 201
        data = res.json()
        assert data["email"] == "newuser@test.com"
        assert data["full_name"] == "New User"
        assert data["role"] == "staff"
        assert "password" not in data
        assert "password_hash" not in data

    async def test_register_duplicate_email(self, client: AsyncClient, staff_user: User):
        res = await client.post("/api/v1/auth/register", json={
            "email": staff_user.email,
            "password": "Pass1234!",
            "full_name": "Duplicate",
        })
        assert res.status_code == 400

    async def test_register_invalid_email(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/register", json={
            "email": "notanemail",
            "password": "Pass1234!",
            "full_name": "Bad Email",
        })
        assert res.status_code == 422


@pytest.mark.asyncio
class TestLogin:
    async def test_login_success(self, client: AsyncClient, staff_user: User):
        res = await client.post("/api/v1/auth/login", json={
            "email": staff_user.email,
            "password": "Test1234!",
        })
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, client: AsyncClient, staff_user: User):
        res = await client.post("/api/v1/auth/login", json={
            "email": staff_user.email,
            "password": "WrongPassword",
        })
        assert res.status_code == 401

    async def test_login_nonexistent_user(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/login", json={
            "email": "noone@test.com",
            "password": "whatever",
        })
        assert res.status_code == 401

    async def test_login_inactive_user(self, client: AsyncClient, inactive_user: User):
        res = await client.post("/api/v1/auth/login", json={
            "email": inactive_user.email,
            "password": "Test1234!",
        })
        assert res.status_code == 403


@pytest.mark.asyncio
class TestGetMe:
    async def test_get_me_success(self, client: AsyncClient, staff_user: User):
        res = await client.get("/api/v1/auth/me", headers=auth_header(staff_user))
        assert res.status_code == 200
        data = res.json()
        assert data["email"] == staff_user.email
        assert "password_hash" not in data

    async def test_get_me_no_token(self, client: AsyncClient):
        res = await client.get("/api/v1/auth/me")
        assert res.status_code in (401, 403)

    async def test_get_me_invalid_token(self, client: AsyncClient):
        res = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
        assert res.status_code == 401


@pytest.mark.asyncio
class TestUpdateProfile:
    async def test_update_name(self, client: AsyncClient, staff_user: User):
        res = await client.patch("/api/v1/auth/me", headers=auth_header(staff_user), json={
            "full_name": "Updated Name",
        })
        assert res.status_code == 200
        assert res.json()["full_name"] == "Updated Name"

    async def test_update_kantor_pajak(self, client: AsyncClient, staff_user: User):
        res = await client.patch("/api/v1/auth/me", headers=auth_header(staff_user), json={
            "kantor_pajak": "KPP Baru",
        })
        assert res.status_code == 200
        assert res.json()["kantor_pajak"] == "KPP Baru"


@pytest.mark.asyncio
class TestChangePassword:
    async def test_change_password_success(self, client: AsyncClient, staff_user: User):
        res = await client.post("/api/v1/auth/me/password", headers=auth_header(staff_user), json={
            "current_password": "Test1234!",
            "new_password": "NewPass123!",
        })
        assert res.status_code == 200

    async def test_change_password_wrong_current(self, client: AsyncClient, staff_user: User):
        res = await client.post("/api/v1/auth/me/password", headers=auth_header(staff_user), json={
            "current_password": "WrongPassword",
            "new_password": "NewPass123!",
        })
        assert res.status_code == 400

    async def test_change_password_too_short(self, client: AsyncClient, staff_user: User):
        res = await client.post("/api/v1/auth/me/password", headers=auth_header(staff_user), json={
            "current_password": "Test1234!",
            "new_password": "ab",
        })
        assert res.status_code == 400


@pytest.mark.asyncio
class TestTokenRefresh:
    async def test_refresh_token(self, client: AsyncClient, staff_user: User):
        # Login first to get refresh token
        login_res = await client.post("/api/v1/auth/login", json={
            "email": staff_user.email,
            "password": "Test1234!",
        })
        refresh_token = login_res.json()["refresh_token"]

        res = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": refresh_token,
        })
        assert res.status_code == 200
        assert "access_token" in res.json()

    async def test_refresh_with_access_token_fails(self, client: AsyncClient, staff_user: User):
        # Try using access token as refresh token
        login_res = await client.post("/api/v1/auth/login", json={
            "email": staff_user.email,
            "password": "Test1234!",
        })
        access_token = login_res.json()["access_token"]

        res = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": access_token,
        })
        assert res.status_code == 401
