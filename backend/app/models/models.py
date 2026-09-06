import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Boolean, DateTime, BigInteger, Integer, ForeignKey, Text, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Administrator(Base):
    __tablename__ = "administrators"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="super_admin")  # super_admin, mail_admin, security_admin, support_admin
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    domains = relationship("Domain", back_populates="organization", cascade="all, delete-orphan")


class Domain(Base):
    __tablename__ = "domains"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    mail_hostname = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=False)
    verification_status = Column(String(50), default="pending")  # active, action_required, pending
    dkim_selector = Column(String(50), default="mail")
    dkim_private_key = Column(Text, nullable=True)
    dkim_public_key = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization", back_populates="domains")
    mailboxes = relationship("Mailbox", back_populates="domain", cascade="all, delete-orphan")
    aliases = relationship("Alias", back_populates="domain", cascade="all, delete-orphan")
    groups = relationship("MailingGroup", back_populates="domain", cascade="all, delete-orphan")
    dns_records = relationship("DnsRecord", back_populates="domain", cascade="all, delete-orphan")


class Mailbox(Base):
    __tablename__ = "mailboxes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    domain_id = Column(UUID(as_uuid=True), ForeignKey("domains.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), nullable=False)
    full_name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    maildir = Column(String(255), nullable=False)
    quota_bytes = Column(BigInteger, default=5368709120)  # Default 5GB
    bytes_used = Column(BigInteger, default=0)
    messages_used = Column(Integer, default=0)
    department = Column(String(100), nullable=True, index=True)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    auto_reply_enabled = Column(Boolean, default=False)
    auto_reply_subject = Column(String(255), nullable=True)
    auto_reply_body = Column(Text, nullable=True)
    signature = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    domain = relationship("Domain", back_populates="mailboxes")
    group_memberships = relationship("MailingGroupMember", back_populates="mailbox", cascade="all, delete-orphan")


class Alias(Base):
    __tablename__ = "aliases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    domain_id = Column(UUID(as_uuid=True), ForeignKey("domains.id", ondelete="CASCADE"), nullable=False, index=True)
    source_email = Column(String(255), unique=True, nullable=False, index=True)
    destination_email = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    domain = relationship("Domain", back_populates="aliases")


class MailingGroup(Base):
    __tablename__ = "mailing_groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    domain_id = Column(UUID(as_uuid=True), ForeignKey("domains.id", ondelete="CASCADE"), nullable=False, index=True)
    group_email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    allow_external = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    domain = relationship("Domain", back_populates="groups")
    members = relationship("MailingGroupMember", back_populates="group", cascade="all, delete-orphan")


class MailingGroupMember(Base):
    __tablename__ = "mailing_group_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    group_id = Column(UUID(as_uuid=True), ForeignKey("mailing_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    mailbox_id = Column(UUID(as_uuid=True), ForeignKey("mailboxes.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint("group_id", "mailbox_id", name="uq_group_mailbox"),)

    group = relationship("MailingGroup", back_populates="members")
    mailbox = relationship("Mailbox", back_populates="group_memberships")


class DnsRecord(Base):
    __tablename__ = "dns_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    domain_id = Column(UUID(as_uuid=True), ForeignKey("domains.id", ondelete="CASCADE"), nullable=False, index=True)
    record_type = Column(String(20), nullable=False)  # A, AAAA, MX, TXT, CNAME, SPF, DKIM, DMARC, PTR
    host = Column(String(255), nullable=False)
    expected_value = Column(Text, nullable=False)
    detected_value = Column(Text, nullable=True)
    status = Column(String(50), default="pending")  # verified, pending, incorrect, missing, warning
    error_reason = Column(Text, nullable=True)
    last_checked_at = Column(DateTime(timezone=True), nullable=True)

    domain = relationship("Domain", back_populates="dns_records")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(JSONB, nullable=False)
    description = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    actor = Column(String(255), nullable=False)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(100), nullable=False)
    resource_id = Column(String(255), nullable=True)
    details = Column(JSONB, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
