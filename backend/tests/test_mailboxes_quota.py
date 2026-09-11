import os
import uuid
import tempfile
import shutil
import pytest
from unittest.mock import AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone

from app.main import app
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.services.mail_service import MailService
from app.models.models import Mailbox


@pytest.fixture
def temp_vmail(monkeypatch):
    temp_dir = tempfile.mkdtemp(prefix="test_vmail_")
    monkeypatch.setattr(settings, "VMAIL_DIR", temp_dir)
    yield temp_dir
    shutil.rmtree(temp_dir, ignore_errors=True)


def test_get_mailbox_folder_breakdown(temp_vmail):
    maildir_relative = "toamun.com/alice/"
    maildir_path = os.path.join(temp_vmail, maildir_relative)

    # Build Maildir directories
    inbox_cur = os.path.join(maildir_path, "cur")
    inbox_new = os.path.join(maildir_path, "new")
    sent_cur = os.path.join(maildir_path, ".Sent", "cur")
    trash_cur = os.path.join(maildir_path, ".Trash", "cur")
    junk_cur = os.path.join(maildir_path, ".Junk", "cur")
    drafts_cur = os.path.join(maildir_path, ".Drafts", "cur")

    for p in [inbox_cur, inbox_new, sent_cur, trash_cur, junk_cur, drafts_cur]:
        os.makedirs(p, exist_ok=True)

    # Populate dummy email files
    with open(os.path.join(inbox_cur, "msg1"), "wb") as f:
        f.write(b"a" * 500)
    with open(os.path.join(inbox_new, "msg2"), "wb") as f:
        f.write(b"b" * 300)
    with open(os.path.join(sent_cur, "msg3"), "wb") as f:
        f.write(b"c" * 1200)
    with open(os.path.join(trash_cur, "msg4"), "wb") as f:
        f.write(b"d" * 400)
    with open(os.path.join(junk_cur, "msg5"), "wb") as f:
        f.write(b"e" * 250)
    with open(os.path.join(drafts_cur, "msg6"), "wb") as f:
        f.write(b"f" * 150)

    breakdown = MailService.get_mailbox_folder_breakdown(maildir_relative)

    assert breakdown["total_bytes"] == 2800
    assert breakdown["total_messages"] == 6

    folders_by_name = {f["name"]: f for f in breakdown["folders"]}
    assert folders_by_name["Inbox"]["bytes_used"] == 800
    assert folders_by_name["Inbox"]["messages_count"] == 2
    assert folders_by_name["Sent"]["bytes_used"] == 1200
    assert folders_by_name["Sent"]["messages_count"] == 1
    assert folders_by_name["Trash"]["bytes_used"] == 400
    assert folders_by_name["Trash"]["messages_count"] == 1
    assert folders_by_name["Junk"]["bytes_used"] == 250
    assert folders_by_name["Junk"]["messages_count"] == 1
    assert folders_by_name["Drafts"]["bytes_used"] == 150
    assert folders_by_name["Drafts"]["messages_count"] == 1


@pytest.mark.asyncio
async def test_mailbox_breakdown_endpoint(temp_vmail, monkeypatch):
    mock_db = AsyncMock()

    # Mock admin auth
    mock_admin = MagicMock()
    mock_admin.id = uuid.uuid4()
    mock_admin.username = "superadmin"
    mock_admin.role = "super_admin"
    mock_admin.is_active = True

    monkeypatch.setattr(
        "app.repositories.admin_repo.AdminRepository.get_by_username",
        AsyncMock(return_value=mock_admin)
    )

    mb_id = uuid.uuid4()
    mock_mb = Mailbox(
        id=mb_id,
        domain_id=uuid.uuid4(),
        email="alice@toamun.com",
        username="alice",
        full_name="Alice Smith",
        password_hash="hash",
        maildir="toamun.com/alice/",
        quota_bytes=5368709120,
        bytes_used=1024,
        messages_used=5,
        department="Engineering",
        is_active=True,
        is_admin=False,
        auto_reply_enabled=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    monkeypatch.setattr(
        "app.repositories.mailbox_repo.MailboxRepository.get_by_id",
        AsyncMock(return_value=mock_mb)
    )

    # Mock DB execute for StorageFile sum
    mock_exec_result = MagicMock()
    mock_exec_result.first.return_value = (5000, 2)
    mock_db.execute = AsyncMock(return_value=mock_exec_result)

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db

    try:
        admin_token = create_access_token({"sub": "superadmin", "role": "super_admin", "type": "admin"})
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get(
                f"/api/v1/mailboxes/{mb_id}/breakdown",
                headers={"Authorization": f"Bearer {admin_token}"}
            )

        assert res.status_code == 200
        data = res.json()
        assert data["email"] == "alice@toamun.com"
        assert data["quota_bytes"] == 5368709120
        assert data["vault_bytes"] == 5000
        assert data["vault_files"] == 2
        assert len(data["folders"]) >= 5
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_recalculate_endpoints(monkeypatch):
    mock_db = AsyncMock()

    mock_admin = MagicMock()
    mock_admin.id = uuid.uuid4()
    mock_admin.username = "superadmin"
    mock_admin.role = "super_admin"
    mock_admin.is_active = True

    monkeypatch.setattr(
        "app.repositories.admin_repo.AdminRepository.get_by_username",
        AsyncMock(return_value=mock_admin)
    )

    mb_id = uuid.uuid4()
    mock_mb = Mailbox(
        id=mb_id,
        domain_id=uuid.uuid4(),
        email="bob@toamun.com",
        username="bob",
        full_name="Bob Jones",
        password_hash="hash",
        maildir="toamun.com/bob/",
        quota_bytes=5368709120,
        bytes_used=0,
        messages_used=0,
        department="Support",
        is_active=True,
        is_admin=False,
        auto_reply_enabled=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    monkeypatch.setattr(
        "app.repositories.mailbox_repo.MailboxRepository.get_by_id",
        AsyncMock(return_value=mock_mb)
    )
    monkeypatch.setattr(
        "app.repositories.mailbox_repo.MailboxRepository.list_all",
        AsyncMock(return_value=[mock_mb])
    )

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db

    try:
        admin_token = create_access_token({"sub": "superadmin", "role": "super_admin", "type": "admin"})
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            # 1. Single recalculation
            res1 = await ac.post(
                f"/api/v1/mailboxes/{mb_id}/recalculate-usage",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert res1.status_code == 200
            assert res1.json()["email"] == "bob@toamun.com"

            # 2. Recalculate all
            res2 = await ac.post(
                "/api/v1/mailboxes/recalculate-all",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert res2.status_code == 200
            assert res2.json()["status"] == "success"
            assert res2.json()["updated_count"] == 1
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_update_mailbox_admin_and_quota(monkeypatch):
    mock_db = AsyncMock()

    mock_admin = MagicMock()
    mock_admin.id = uuid.uuid4()
    mock_admin.username = "superadmin"
    mock_admin.role = "super_admin"
    mock_admin.is_active = True

    monkeypatch.setattr(
        "app.repositories.admin_repo.AdminRepository.get_by_username",
        AsyncMock(return_value=mock_admin)
    )

    mb_id = uuid.uuid4()
    mock_mb = Mailbox(
        id=mb_id,
        domain_id=uuid.uuid4(),
        email="clara@toamun.com",
        username="clara",
        full_name="Clara Oswald",
        password_hash="hash",
        maildir="toamun.com/clara/",
        quota_bytes=5368709120,
        bytes_used=0,
        messages_used=0,
        department="General",
        is_active=True,
        is_admin=False,
        auto_reply_enabled=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    monkeypatch.setattr(
        "app.repositories.mailbox_repo.MailboxRepository.get_by_id",
        AsyncMock(return_value=mock_mb)
    )

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db

    try:
        admin_token = create_access_token({"sub": "superadmin", "role": "super_admin", "type": "admin"})
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.put(
                f"/api/v1/mailboxes/{mb_id}",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={
                    "full_name": "Clara Oswald-Admin",
                    "department": "Security",
                    "quota_mb": 10240,
                    "is_admin": True,
                    "auto_reply_enabled": True,
                    "auto_reply_subject": "Away at conference",
                    "auto_reply_body": "Will be back on Monday"
                }
            )

        assert res.status_code == 200
        data = res.json()
        assert data["full_name"] == "Clara Oswald-Admin"
        assert data["department"] == "Security"
        assert data["quota_bytes"] == 10240 * 1024 * 1024
        assert data["is_admin"] is True
        assert data["auto_reply_enabled"] is True
        assert data["auto_reply_subject"] == "Away at conference"
    finally:
        app.dependency_overrides.pop(get_db, None)
