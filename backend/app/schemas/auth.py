from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime
import uuid


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str


class LoginRequest(BaseModel):
    username: str
    password: str


class AdminCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "super_admin"


class AdminOut(BaseModel):
    id: uuid.UUID
    username: str
    email: EmailStr
    role: str
    is_active: bool
    last_login: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)



class BootstrapStatus(BaseModel):
    is_bootstrapped: bool
    public_ip: str
    server_time: datetime
    hostname: str
    total_domains: int
    total_mailboxes: int
