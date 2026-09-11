from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime
import uuid


class DnsRecordOut(BaseModel):
    id: uuid.UUID
    record_type: str
    host: str
    expected_value: str
    detected_value: Optional[str] = None
    status: str  # verified, pending, incorrect, missing, warning
    error_reason: Optional[str] = None
    last_checked_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DomainCreate(BaseModel):
    name: str
    mail_hostname: Optional[str] = None  # If not provided, defaults to mail.<name>


class DomainOut(BaseModel):
    id: uuid.UUID
    name: str
    mail_hostname: str
    is_active: bool
    verification_status: str
    dkim_selector: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)



class DomainDetailOut(DomainOut):
    dns_records: List[DnsRecordOut] = []
    total_mailboxes: int = 0
    total_aliases: int = 0
    total_groups: int = 0
    ssl_status: Optional[str] = None


class DnsVerificationResult(BaseModel):
    domain_id: uuid.UUID
    domain_name: str
    overall_status: str  # active, action_required
    records: List[DnsRecordOut]
    ssl_status: Optional[str] = None
    ssl_message: Optional[str] = None
