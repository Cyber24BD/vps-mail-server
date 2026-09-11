from typing import Optional, List
from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime
import uuid


class MailboxCreate(BaseModel):
    domain_id: uuid.UUID
    email: EmailStr
    full_name: str
    password: str
    quota_mb: Optional[int] = 5120  # Default 5GB
    department: Optional[str] = None
    is_admin: Optional[bool] = False


class MailboxUpdate(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None
    quota_mb: Optional[int] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    auto_reply_enabled: Optional[bool] = None
    auto_reply_subject: Optional[str] = None
    auto_reply_body: Optional[str] = None
    signature: Optional[str] = None


class MailboxOut(BaseModel):
    id: uuid.UUID
    domain_id: uuid.UUID
    email: EmailStr
    username: str
    full_name: str
    quota_bytes: int
    bytes_used: int
    messages_used: int
    department: Optional[str] = None
    is_active: bool
    is_admin: bool
    auto_reply_enabled: bool
    auto_reply_subject: Optional[str] = None
    auto_reply_body: Optional[str] = None
    signature: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class QuotaUpdate(BaseModel):
    quota_mb: int


class FolderStorageStat(BaseModel):
    name: str
    bytes_used: int
    messages_count: int


class MailboxStorageBreakdown(BaseModel):
    mailbox_id: uuid.UUID
    email: str
    quota_bytes: int
    bytes_used: int
    messages_used: int
    percent_used: float
    folders: List[FolderStorageStat]
    vault_bytes: int
    vault_files: int

