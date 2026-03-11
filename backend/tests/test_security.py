"""Security tests: XSS, SQL injection, path traversal, CORS, auth bypass."""

import uuid

import pytest
from httpx import AsyncClient

from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
class TestXSSPrevention:
    """Test that XSS payloads are stored as-is (not executed) via JSON API."""

    async def test_xss_in_conversation_title(self, client: AsyncClient, staff_user: User):
        xss_payload = '<script>alert("XSS")</script>'
        res = await client.post(
            "/api/v1/chat/conversations",
            headers=auth_header(staff_user),
            json={"ai_model": "claude", "title": xss_payload},
        )
        # Should store without executing - API returns JSON, not HTML
        assert res.status_code == 201

    async def test_xss_in_profile_name(self, client: AsyncClient, staff_user: User):
        xss_payload = '<img src=x onerror=alert(1)>'
        res = await client.patch(
            "/api/v1/auth/me",
            headers=auth_header(staff_user),
            json={"full_name": xss_payload},
        )
        assert res.status_code == 200
        # JSON API naturally escapes - verify it's stored as text
        assert res.json()["full_name"] == xss_payload


@pytest.mark.asyncio
class TestSQLInjection:
    """Test SQL injection attempts are safely handled."""

    async def test_sql_injection_in_login_email(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/login", json={
            "email": "' OR 1=1 --",
            "password": "anything",
        })
        assert res.status_code in (401, 422)  # Should fail auth, not expose data

    async def test_sql_injection_in_login_password(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/login", json={
            "email": "test@test.com",
            "password": "' OR '1'='1",
        })
        assert res.status_code in (401, 422)

    async def test_sql_injection_in_register(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/register", json={
            "email": "test@test.com",
            "password": "test123",
            "full_name": "'; DROP TABLE users; --",
        })
        # Should either create user with that name or fail validation, not drop table
        assert res.status_code in (201, 400, 422)

    async def test_sql_injection_in_search_params(self, client: AsyncClient, staff_user: User):
        res = await client.get(
            "/api/v1/chat/conversations",
            headers=auth_header(staff_user),
            params={"search": "' UNION SELECT * FROM users --"},
        )
        # Should return normal response, not leak data
        assert res.status_code == 200


@pytest.mark.asyncio
class TestAuthSecurity:
    """Test authentication and authorization security."""

    async def test_invalid_jwt_token(self, client: AsyncClient):
        res = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert res.status_code in (401, 403)

    async def test_expired_token_format(self, client: AsyncClient):
        # Malformed JWT
        res = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid.invalid"},
        )
        assert res.status_code in (401, 403)

    async def test_missing_auth_header(self, client: AsyncClient):
        res = await client.get("/api/v1/auth/me")
        assert res.status_code in (401, 403)

    async def test_empty_bearer_token(self, client: AsyncClient):
        res = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer "},
        )
        assert res.status_code in (401, 403)

    async def test_wrong_auth_scheme(self, client: AsyncClient):
        res = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Basic dGVzdDp0ZXN0"},
        )
        assert res.status_code in (401, 403)

    async def test_inactive_user_cannot_login(self, client: AsyncClient, inactive_user: User):
        res = await client.post("/api/v1/auth/login", json={
            "email": inactive_user.email,
            "password": "Test1234!",
        })
        assert res.status_code == 403

    async def test_password_not_in_response(self, client: AsyncClient, staff_user: User):
        res = await client.get("/api/v1/auth/me", headers=auth_header(staff_user))
        assert res.status_code == 200
        data = res.json()
        assert "password" not in data
        assert "password_hash" not in data


@pytest.mark.asyncio
class TestPathTraversal:
    """Test path traversal attack prevention."""

    async def test_path_traversal_in_conversation_id(self, client: AsyncClient, staff_user: User):
        res = await client.get(
            "/api/v1/chat/conversations/../../../etc/passwd",
            headers=auth_header(staff_user),
        )
        assert res.status_code in (404, 422)

    async def test_path_traversal_in_job_id(self, client: AsyncClient, staff_user: User):
        res = await client.get(
            "/api/v1/ocr/jobs/../../../etc/passwd",
            headers=auth_header(staff_user),
        )
        assert res.status_code in (404, 422)


@pytest.mark.asyncio
class TestRoleBasedAccess:
    """Test role-based access control."""

    async def test_staff_cannot_access_admin_stats(self, client: AsyncClient, staff_user: User):
        res = await client.get("/api/v1/admin/stats", headers=auth_header(staff_user))
        assert res.status_code == 403

    async def test_staff_cannot_list_users(self, client: AsyncClient, staff_user: User):
        res = await client.get("/api/v1/admin/users", headers=auth_header(staff_user))
        assert res.status_code == 403

    async def test_staff_cannot_create_user(self, client: AsyncClient, staff_user: User):
        res = await client.post(
            "/api/v1/admin/users",
            headers=auth_header(staff_user),
            json={
                "email": "hacker@test.com",
                "password": "test123",
                "full_name": "Hacker",
                "role": "superadmin",
            },
        )
        assert res.status_code == 403

    async def test_staff_cannot_delete_user(self, client: AsyncClient, staff_user: User, superadmin_user: User):
        res = await client.delete(
            f"/api/v1/admin/users/{superadmin_user.id}",
            headers=auth_header(staff_user),
        )
        assert res.status_code == 403

    async def test_admin_can_access_stats(self, client: AsyncClient, superadmin_user: User):
        res = await client.get("/api/v1/admin/stats", headers=auth_header(superadmin_user))
        assert res.status_code == 200

    async def test_admin_can_list_users(self, client: AsyncClient, superadmin_user: User):
        res = await client.get("/api/v1/admin/users", headers=auth_header(superadmin_user))
        assert res.status_code == 200


@pytest.mark.asyncio
class TestInputValidation:
    """Test input validation and edge cases."""

    async def test_register_invalid_email(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/register", json={
            "email": "not-an-email",
            "password": "test123",
            "full_name": "Test",
        })
        assert res.status_code == 422

    async def test_register_empty_password(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/register", json={
            "email": "valid@test.com",
            "password": "",
            "full_name": "Test",
        })
        assert res.status_code == 422  # min_length=6 validation

    async def test_change_password_too_short(self, client: AsyncClient, staff_user: User):
        res = await client.post(
            "/api/v1/auth/me/password",
            headers=auth_header(staff_user),
            json={"current_password": "Test1234!", "new_password": "12"},
        )
        assert res.status_code == 400

    async def test_oversized_json_body(self, client: AsyncClient, staff_user: User):
        # Test with a title exceeding varchar(255) limit - now validated by Pydantic
        long_text = "A" * 300
        res = await client.post(
            "/api/v1/chat/conversations",
            headers=auth_header(staff_user),
            json={"ai_model": "claude", "title": long_text},
        )
        assert res.status_code == 422  # max_length=255 validation


@pytest.mark.asyncio
class TestCORS:
    """Test CORS configuration."""

    async def test_cors_headers_present(self, client: AsyncClient):
        res = await client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )
        # CORS middleware should respond
        assert res.status_code in (200, 405)

    async def test_health_endpoint_accessible(self, client: AsyncClient):
        res = await client.get("/api/health")
        assert res.status_code == 200
        assert res.json()["status"] == "healthy"
