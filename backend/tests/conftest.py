"""Shared test fixtures for Chatbot Pajak backend tests."""

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
)

from app.main import app
from app.database import Base, get_db
from app.models.user import User
from app.services.auth_service import hash_password, create_access_token

# Use a test database
TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/chatbot_pajak_test"


def _make_engine():
    return create_async_engine(TEST_DATABASE_URL, echo=False)


@pytest.fixture(scope="session", autouse=True)
def setup_database_sync():
    """Create all tables once at the start using a sync event loop."""
    import asyncio

    async def _setup():
        engine = _make_engine()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        await engine.dispose()

    asyncio.run(_setup())
    yield

    async def _teardown():
        engine = _make_engine()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()

    asyncio.run(_teardown())


@pytest_asyncio.fixture
async def engine():
    eng = _make_engine()
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def db_session(engine):
    """Per-test database session."""
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(engine):
    """Async test client. Each request gets its own DB session."""
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def superadmin_user(db_session: AsyncSession) -> User:
    """Create a superadmin user for tests."""
    user = User(
        id=uuid.uuid4(),
        email=f"superadmin-{uuid.uuid4().hex[:6]}@test.com",
        password_hash=hash_password("Test1234!"),
        full_name="Test Super Admin",
        role="superadmin",
        kantor_pajak="KPP Test",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def staff_user(db_session: AsyncSession) -> User:
    """Create a staff user for tests."""
    user = User(
        id=uuid.uuid4(),
        email=f"staff-{uuid.uuid4().hex[:6]}@test.com",
        password_hash=hash_password("Test1234!"),
        full_name="Test Staff",
        role="staff",
        kantor_pajak="KPP Test",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def inactive_user(db_session: AsyncSession) -> User:
    """Create an inactive user for tests."""
    user = User(
        id=uuid.uuid4(),
        email=f"inactive-{uuid.uuid4().hex[:6]}@test.com",
        password_hash=hash_password("Test1234!"),
        full_name="Inactive User",
        role="staff",
        is_active=False,
    )
    db_session.add(user)
    await db_session.commit()
    return user


def auth_header(user: User) -> dict[str, str]:
    """Generate Authorization header for a user."""
    token = create_access_token(str(user.id))
    return {"Authorization": f"Bearer {token}"}
