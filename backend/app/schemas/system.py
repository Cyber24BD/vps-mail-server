from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime
import uuid


class ServiceHealth(BaseModel):
    name: str
    status: str  # healthy, warning, critical, offline
    details: Optional[str] = None
    response_time_ms: Optional[float] = None


class SystemHealthOverview(BaseModel):
    overall_status: str  # healthy, warning, critical
    timestamp: datetime
    services: List[ServiceHealth]


class SystemResourceMetrics(BaseModel):
    cpu_percent: float
    memory_total_mb: float
    memory_used_mb: float
    memory_percent: float
    disk_total_gb: float
    disk_used_gb: float
    disk_percent: float
    active_connections: int
    mail_queue_count: int


class AuditLogOut(BaseModel):
    id: uuid.UUID
    actor: str
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)



class BackupOut(BaseModel):
    filename: str
    size_mb: float
    created_at: datetime
    backup_type: str  # full, database, mailboxes
