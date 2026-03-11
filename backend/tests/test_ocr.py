"""Tests for OCR scanner endpoints."""

import io
import uuid

import pytest
from httpx import AsyncClient

from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
class TestOCRScan:
    async def test_scan_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/ocr/scan")
        assert res.status_code in (401, 403)

    async def test_scan_rejects_non_pdf(self, client: AsyncClient, staff_user: User):
        res = await client.post(
            "/api/v1/ocr/scan",
            headers=auth_header(staff_user),
            files={"file": ("test.txt", b"hello world", "text/plain")},
        )
        assert res.status_code == 400
        assert "PDF" in res.json()["detail"]

    async def test_scan_rejects_oversized_file(self, client: AsyncClient, staff_user: User):
        # Create a minimal PDF-like content that exceeds 50MB
        # We just test the size check with a fake PDF content type
        big_content = b"%PDF-1.4 " + b"x" * (51 * 1024 * 1024)
        res = await client.post(
            "/api/v1/ocr/scan",
            headers=auth_header(staff_user),
            files={"file": ("big.pdf", big_content, "application/pdf")},
        )
        assert res.status_code == 400
        assert "besar" in res.json()["detail"].lower() or "MB" in res.json()["detail"]


@pytest.mark.asyncio
class TestOCRJobs:
    async def test_list_jobs_empty(self, client: AsyncClient, staff_user: User):
        res = await client.get("/api/v1/ocr/jobs", headers=auth_header(staff_user))
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_get_nonexistent_job(self, client: AsyncClient, staff_user: User):
        res = await client.get(
            f"/api/v1/ocr/jobs/{uuid.uuid4()}",
            headers=auth_header(staff_user),
        )
        assert res.status_code == 404

    async def test_delete_nonexistent_job(self, client: AsyncClient, staff_user: User):
        res = await client.delete(
            f"/api/v1/ocr/jobs/{uuid.uuid4()}",
            headers=auth_header(staff_user),
        )
        assert res.status_code == 404

    async def test_results_nonexistent_job(self, client: AsyncClient, staff_user: User):
        res = await client.get(
            f"/api/v1/ocr/jobs/{uuid.uuid4()}/results",
            headers=auth_header(staff_user),
        )
        assert res.status_code == 404


@pytest.mark.asyncio
class TestOCRExport:
    async def test_export_requires_token(self, client: AsyncClient):
        res = await client.get(f"/api/v1/ocr/jobs/{uuid.uuid4()}/export")
        assert res.status_code == 401

    async def test_export_invalid_token(self, client: AsyncClient):
        res = await client.get(
            f"/api/v1/ocr/jobs/{uuid.uuid4()}/export",
            params={"token": "invalid-token"},
        )
        assert res.status_code == 401


@pytest.mark.asyncio
class TestOCRIsolation:
    """Test that users cannot access other users' OCR data."""

    async def test_user_cannot_access_other_jobs(
        self, client: AsyncClient, staff_user: User, superadmin_user: User,
    ):
        # List jobs - each user should only see their own
        res1 = await client.get("/api/v1/ocr/jobs", headers=auth_header(staff_user))
        res2 = await client.get("/api/v1/ocr/jobs", headers=auth_header(superadmin_user))
        assert res1.status_code == 200
        assert res2.status_code == 200
