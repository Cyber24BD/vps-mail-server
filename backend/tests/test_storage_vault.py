import os
import uuid
import tempfile
import shutil
import pytest
from unittest.mock import AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.services.storage_vault_service import StorageVaultService
from app.models.models import StorageFile, StorageFilePermission


@pytest.fixture(autouse=True)
def temp_storage_env(monkeypatch):
    temp_dir = tempfile.mkdtemp(prefix="corpmail_storage_test_")
    monkeypatch.setattr(settings, "VMAIL_DIR", temp_dir)
    monkeypatch.setattr(settings, "ENVIRONMENT", "test")
    yield temp_dir
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_store_attachment(temp_storage_env):
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=None))

    file_bytes = b"Hello, this is a test report file content."
    filename = "report.txt"
    sender = "it@toamun.com"

    stored = await StorageVaultService.store_attachment(
        sender_mailbox=sender,
        file_bytes=file_bytes,
        filename=filename,
        content_type="text/plain",
        db=mock_db,
        subject="Monthly Performance"
    )

    assert stored is not None
    assert stored.filename == "report.txt"
    assert stored.filesize == len(file_bytes)
    assert stored.owner_mailbox == sender
    assert os.path.exists(stored.file_path)
    with open(stored.file_path, "rb") as f:
        assert f.read() == file_bytes


@pytest.mark.asyncio
async def test_path_traversal_protection(temp_storage_env):
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
    file_bytes = b"Secret malicious content"
    malicious_filename = "../../../etc/passwd"

    # Should sanitize filename and keep within user's storage vault
    stored = await StorageVaultService.store_attachment(
        sender_mailbox="it@toamun.com",
        file_bytes=file_bytes,
        filename=malicious_filename,
        content_type="text/plain",
        db=mock_db
    )

    expected_dir = StorageVaultService.get_user_storage_dir("it@toamun.com")
    real_path = os.path.realpath(stored.file_path)
    real_dir = os.path.realpath(expected_dir)
    assert real_path.startswith(real_dir)
    assert "passwd" in stored.filename


@pytest.mark.asyncio
async def test_grant_permissions_and_acl():
    file_id = uuid.uuid4()
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=None))

    # Grant to admin@toamun.com
    perms = await StorageVaultService.grant_permissions(
        file_id=file_id,
        recipient_emails=["admin@toamun.com"],
        db=mock_db
    )
    assert len(perms) == 1
    assert perms[0].granted_to == "admin@toamun.com"

    # Test ACL access check
    mock_file = MagicMock(spec=StorageFile)
    mock_file.id = file_id
    mock_file.owner_mailbox = "it@toamun.com"
    perm_mock = MagicMock(spec=StorageFilePermission)
    perm_mock.granted_to = "admin@toamun.com"
    mock_file.permissions = [perm_mock]

    mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=mock_file))

    # 1. Owner can access
    access_owner = await StorageVaultService.get_file_for_access(file_id, "it@toamun.com", False, mock_db)
    assert access_owner is not None

    # 2. Granted recipient can access
    access_granted = await StorageVaultService.get_file_for_access(file_id, "admin@toamun.com", False, mock_db)
    assert access_granted is not None

    # 3. Third-party ungranted user is DENIED
    access_denied = await StorageVaultService.get_file_for_access(file_id, "stranger@toamun.com", False, mock_db)
    assert access_denied is None

    # 4. Super admin is allowed
    access_admin = await StorageVaultService.get_file_for_access(file_id, "other@domain.com", True, mock_db)
    assert access_admin is not None


@pytest.mark.asyncio
async def test_delete_attachment_disk_cleanup(temp_storage_env):
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
    file_bytes = b"Data to be unlinked"
    stored = await StorageVaultService.store_attachment(
        sender_mailbox="it@toamun.com",
        file_bytes=file_bytes,
        filename="temp_delete.txt",
        content_type="text/plain",
        db=mock_db
    )
    assert os.path.exists(stored.file_path)

    mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=stored))

    # Unauthorized user attempts deletion -> Fails
    success_fail, _ = await StorageVaultService.delete_file(
        file_id=stored.id,
        requesting_mailbox="hacker@toamun.com",
        is_admin=False,
        db=mock_db
    )
    assert success_fail is False
    assert os.path.exists(stored.file_path)

    # Owner deletes -> Succeeds and file is removed from disk
    success, msg = await StorageVaultService.delete_file(
        file_id=stored.id,
        requesting_mailbox="it@toamun.com",
        is_admin=False,
        db=mock_db
    )
    assert success is True
    assert not os.path.exists(stored.file_path)


@pytest.mark.asyncio
async def test_storage_api_endpoints():
    token = create_access_token({"sub": "it@toamun.com", "role": "user", "type": "mailbox"})
    headers = {"Authorization": f"Bearer {token}"}

    mock_db = AsyncMock()
    mock_mb = MagicMock()
    mock_mb.email = "it@toamun.com"
    mock_mb.quota_bytes = 5368709120

    # Mock execute for stats and files
    mock_res_mb = MagicMock(scalar_one_or_none=MagicMock(return_value=mock_mb))
    mock_res_rows = MagicMock(all=MagicMock(return_value=[(1024, "application/pdf")]))
    mock_res_count = MagicMock(scalar=MagicMock(return_value=1))
    mock_res_scalars = MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))))

    mock_db.execute.side_effect = [
        mock_res_mb,      # mailbox quota
        mock_res_rows,    # rows for stats
        mock_res_count,   # total files count
        mock_res_scalars  # files query
    ]

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 1. GET stats
            res_stats = await client.get("/api/v1/storage/stats", headers=headers)
            assert res_stats.status_code == 200
            data_stats = res_stats.json()
            assert data_stats["mailbox_email"] == "it@toamun.com"
            assert "breakdown" in data_stats
            assert data_stats["breakdown"]["documents"]["bytes"] == 1024

            # 2. GET files
            res_files = await client.get("/api/v1/storage/files?category=documents", headers=headers)
            assert res_files.status_code == 200
            data_files = res_files.json()
            assert "files" in data_files
            assert "total" in data_files
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_validate_safe_vault_path_rules(temp_storage_env):
    user_email = "it@toamun.com"
    vault_dir = StorageVaultService.get_user_storage_dir(user_email)
    test_uuid = uuid.uuid4()

    valid_file = os.path.join(vault_dir, f"{test_uuid.hex}_annual_plan.pdf")
    with open(valid_file, "w") as f:
        f.write("content")

    # 1. Valid file in jail -> Passes
    is_safe, reason = StorageVaultService.validate_safe_vault_path(valid_file, user_email, test_uuid.hex)
    assert is_safe is True
    assert reason == ""

    # 2. Path escaping vault (e.g. /etc/hosts or ..) -> Blocked
    escaped_file = os.path.join(vault_dir, "..", "passwords.txt")
    is_safe, reason = StorageVaultService.validate_safe_vault_path(escaped_file, user_email, test_uuid.hex)
    assert is_safe is False
    assert "escapes" in reason

    # 3. Path pointing to vault root itself -> Blocked
    is_safe, reason = StorageVaultService.validate_safe_vault_path(vault_dir, user_email, test_uuid.hex)
    assert is_safe is False

    # 4. Wrong UUID prefix on disk -> Blocked
    wrong_uuid = uuid.uuid4()
    is_safe, reason = StorageVaultService.validate_safe_vault_path(valid_file, user_email, wrong_uuid.hex)
    assert is_safe is False
    assert "identifier" in reason


@pytest.mark.asyncio
async def test_dangerous_unlinking_blocked_by_guard(temp_storage_env):
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=None))

    # Create a malicious StorageFile entry pointing to /etc/shadow or parent
    malicious_id = uuid.uuid4()
    malicious_record = MagicMock(spec=StorageFile)
    malicious_record.id = malicious_id
    malicious_record.owner_mailbox = "it@toamun.com"
    malicious_record.file_path = "/etc/shadow"
    malicious_record.filesize = 100

    mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=malicious_record))

    success, msg = await StorageVaultService.delete_file(
        file_id=malicious_id,
        requesting_mailbox="it@toamun.com",
        is_admin=True,
        db=mock_db
    )

    # Must be intercepted and blocked!
    assert success is False
    assert "Refused dangerous disk operation" in msg

