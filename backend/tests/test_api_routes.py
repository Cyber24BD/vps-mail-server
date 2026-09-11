import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_root_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"
    assert "version" in response.json()


@pytest.mark.asyncio
async def test_bootstrap_specs_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/bootstrap/system-specs")
    assert response.status_code == 200
    data = response.json()
    assert "public_ip" in data
    assert "cpu_cores" in data
    assert "ram_total_mb" in data
    assert "primary_ports" in data


@pytest.mark.asyncio
async def test_auth_me_endpoints(monkeypatch):
    import uuid
    from unittest.mock import AsyncMock, MagicMock
    from app.core.security import create_access_token
    from app.core.database import get_db

    # Mock DB
    async def override_get_db():
        mock_session = AsyncMock()
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db

    try:
        # 1. Test admin /auth/me
        mock_admin = MagicMock()
        mock_admin.id = uuid.uuid4()
        mock_admin.username = "superadmin"
        mock_admin.email = "admin@example.com"
        mock_admin.role = "super_admin"
        mock_admin.is_active = True
        mock_admin.last_login = None
        mock_admin.created_at = None

        monkeypatch.setattr(
            "app.repositories.admin_repo.AdminRepository.get_by_username",
            AsyncMock(return_value=mock_admin)
        )

        admin_token = create_access_token({"sub": "superadmin", "role": "super_admin", "type": "admin"})
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res_admin = await ac.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
        assert res_admin.status_code == 200
        admin_data = res_admin.json()
        assert admin_data["username"] == "superadmin"
        assert admin_data["type"] == "admin"
        assert admin_data["role"] == "super_admin"

        # 2. Test mailbox /auth/me
        mock_mb = MagicMock()
        mock_mb.id = uuid.uuid4()
        mock_mb.email = "john@example.com"
        mock_mb.is_active = True
        mock_mb.created_at = None

        monkeypatch.setattr(
            "app.repositories.mailbox_repo.MailboxRepository.get_by_email",
            AsyncMock(return_value=mock_mb)
        )

        mb_token = create_access_token({"sub": "john@example.com", "role": "user", "type": "mailbox"})
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res_mb = await ac.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {mb_token}"}
            )
        assert res_mb.status_code == 200
        mb_data = res_mb.json()
        assert mb_data["username"] == "john@example.com"
        assert mb_data["type"] == "mailbox"
        assert mb_data["role"] == "user"

    finally:
        app.dependency_overrides.pop(get_db, None)

