from typing import List, Optional
from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime
import uuid


class AliasCreate(BaseModel):
    domain_id: uuid.UUID
    source_email: EmailStr
    destination_email: EmailStr


class AliasOut(BaseModel):
    id: uuid.UUID
    domain_id: uuid.UUID
    source_email: EmailStr
    destination_email: EmailStr
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GroupMemberOut(BaseModel):
    mailbox_id: uuid.UUID
    email: EmailStr
    full_name: str


class GroupCreate(BaseModel):
    domain_id: uuid.UUID
    group_email: EmailStr
    name: str
    description: Optional[str] = None
    allow_external: bool = False
    member_mailbox_ids: List[uuid.UUID] = []


class GroupOut(BaseModel):
    id: uuid.UUID
    domain_id: uuid.UUID
    group_email: EmailStr
    name: str
    description: Optional[str] = None
    allow_external: bool
    members_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

