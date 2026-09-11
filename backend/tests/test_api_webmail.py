import os
import shutil
import tempfile
from unittest.mock import AsyncMock, MagicMock
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token


@pytest.fixture(autouse=True)
def temp_vmail(monkeypatch):
    temp_dir = tempfile.mkdtemp(prefix="corpmail_api_test_vmail_")
    monkeypatch.setattr(settings, "VMAIL_DIR", temp_dir)
    monkeypatch.setattr(settings, "ENVIRONMENT", "test")

    # Mock get_db to prevent connecting to PostgreSQL during standalone test runs
    async def override_get_db():
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.commit = AsyncMock()
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db
    yield temp_dir
    app.dependency_overrides.pop(get_db, None)
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_api_webmail_endpoints():
    token = create_access_token({"sub": "admin", "role": "super_admin", "type": "admin"})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Test Delivery
        res_inject = await client.post("/api/v1/webmail/test-delivery?mailbox=testuser@example.com", headers=headers)
        assert res_inject.status_code == 200
        assert res_inject.json()["success"] is True

        # 2. Get Folders
        res_folders = await client.get("/api/v1/webmail/folders?mailbox=testuser@example.com", headers=headers)
        assert res_folders.status_code == 200
        data_folders = res_folders.json()
        assert "folders" in data_folders
        inbox = next(f for f in data_folders["folders"] if f["key"] == "inbox")
        assert inbox["total"] == 1
        assert inbox["unread"] == 1

        # 3. List Messages
        res_msgs = await client.get("/api/v1/webmail/messages?folder=inbox&mailbox=testuser@example.com", headers=headers)
        assert res_msgs.status_code == 200
        msgs = res_msgs.json()
        assert len(msgs) == 1
        msg_id = msgs[0]["id"]

        # 4. Message Detail (marks read)
        res_detail = await client.get(f"/api/v1/webmail/messages/{msg_id}?folder=inbox&mailbox=testuser@example.com", headers=headers)
        assert res_detail.status_code == 200
        assert res_detail.json()["is_read"] is True

        # 5. Spam Check Endpoint
        res_spam = await client.post("/api/v1/webmail/spam-check", json={
            "subject": "Regular project update",
            "body_text": "Hi, please review the latest designs.",
            "attachment_names": ["design.png"]
        }, headers=headers)
        assert res_spam.status_code == 200
        assert res_spam.json()["is_safe"] is True

        # 6. Send Email JSON
        res_send = await client.post("/api/v1/webmail/send-json", json={
            "recipient": "colleague@example.com",
            "subject": "Greetings from Webmail",
            "body_text": "Hello, this is a test outgoing email.",
            "mailbox": "testuser@example.com"
        }, headers=headers)
        assert res_send.status_code == 200
        assert res_send.json()["success"] is True

        # 7. Verify sent message in 'sent' folder
        res_sent = await client.get("/api/v1/webmail/messages?folder=sent&mailbox=testuser@example.com", headers=headers)
        assert res_sent.status_code == 200
        sent_msgs = res_sent.json()
        assert len(sent_msgs) == 1
        assert sent_msgs[0]["subject"] == "Greetings from Webmail"

        # 8. Bulk Action: Delete from inbox
        res_bulk = await client.post("/api/v1/webmail/bulk?mailbox=testuser@example.com", json={
            "action": "delete",
            "message_ids": [msg_id],
            "folder": "inbox"
        }, headers=headers)
        assert res_bulk.status_code == 200
        assert res_bulk.json()["affected_count"] == 1
