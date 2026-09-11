import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.models import StorageFile
from app.repositories.domain_repo import DomainRepository
from app.repositories.mailbox_repo import MailboxRepository
from app.schemas.mailbox import (
    MailboxCreate,
    MailboxUpdate,
    MailboxOut,
    QuotaUpdate,
    MailboxStorageBreakdown,
)
from app.services.mail_service import MailService
from app.services.security_service import SecurityService
from app.api.deps import get_current_admin, log_action

router = APIRouter()


@router.get("/", response_model=List[MailboxOut])
async def list_mailboxes(
    domain_id: Optional[uuid.UUID] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    mailbox_repo = MailboxRepository(db)
    if domain_id:
        return await mailbox_repo.list_by_domain(domain_id)
    return await mailbox_repo.list_all(limit=limit, offset=offset)


@router.post("/", response_model=MailboxOut)
async def create_mailbox(
    mb_in: MailboxCreate,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    domain_repo = DomainRepository(db)
    mailbox_repo = MailboxRepository(db)

    # 1. Validate domain exists
    domain = await domain_repo.get_by_id(mb_in.domain_id)
    if not domain:
        raise HTTPException(status_code=404, detail="Domain does not exist")

    # 2. Check if email matches domain
    email = mb_in.email.lower().strip()
    if not email.endswith(f"@{domain.name}"):
        raise HTTPException(
            status_code=400,
            detail=f"Email address must belong to domain '@{domain.name}'"
        )

    # 3. Check for existing mailbox
    existing = await mailbox_repo.get_by_email(email)
    if existing:
        raise HTTPException(status_code=400, detail=f"Mailbox '{email}' already exists")

    quota_bytes = (mb_in.quota_mb or 5120) * 1024 * 1024
    mailbox = await mailbox_repo.create(
        domain_id=domain.id,
        email=email,
        full_name=mb_in.full_name,
        password=mb_in.password,
        quota_bytes=quota_bytes,
        department=mb_in.department,
        is_admin=mb_in.is_admin or False
    )

    # 4. Provision physical Maildir on host
    MailService.provision_mailbox_directory(mailbox.maildir)

    # 5. Check SSL for domain and auto-provision if DNS is verified
    try:
        SecurityService.auto_provision_ssl_if_needed(
            domain_name=domain.name,
            mail_hostname=domain.mail_hostname,
            admin_email=f"admin@{domain.name}"
        )
    except Exception:
        pass

    await log_action(
        db,
        actor=admin.username,
        action="CREATE_MAILBOX",
        resource_type="mailbox",
        resource_id=str(mailbox.id),
        details={"email": mailbox.email, "quota_mb": mb_in.quota_mb}
    )
    await db.commit()
    return mailbox


@router.post("/recalculate-all")
async def recalculate_all_mailboxes(
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    mailbox_repo = MailboxRepository(db)
    all_mailboxes = await mailbox_repo.list_all(limit=1000, offset=0)
    updated_count = 0
    for mb in all_mailboxes:
        stats = MailService.get_mailbox_usage(mb.maildir)
        mb.bytes_used = stats["bytes_used"]
        mb.messages_used = stats["messages_used"]
        updated_count += 1
    await db.commit()
    return {"status": "success", "updated_count": updated_count}


@router.get("/{mailbox_id}", response_model=MailboxOut)
async def get_mailbox(
    mailbox_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    mailbox_repo = MailboxRepository(db)
    mb = await mailbox_repo.get_by_id(mailbox_id)
    if not mb:
        raise HTTPException(status_code=404, detail="Mailbox not found")

    # Update real-time storage stats
    stats = MailService.get_mailbox_usage(mb.maildir)
    mb.bytes_used = stats["bytes_used"]
    mb.messages_used = stats["messages_used"]
    await db.commit()
    return mb


@router.get("/{mailbox_id}/breakdown", response_model=MailboxStorageBreakdown)
async def get_mailbox_storage_breakdown(
    mailbox_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    mailbox_repo = MailboxRepository(db)
    mb = await mailbox_repo.get_by_id(mailbox_id)
    if not mb:
        raise HTTPException(status_code=404, detail="Mailbox not found")

    breakdown = MailService.get_mailbox_folder_breakdown(mb.maildir)

    # Sync disk stats to mailbox row
    mb.bytes_used = breakdown["total_bytes"]
    mb.messages_used = breakdown["total_messages"]
    await db.commit()

    # Query Storage Vault files
    vault_result = await db.execute(
        select(
            func.coalesce(func.sum(StorageFile.filesize), 0),
            func.count(StorageFile.id)
        ).where(
            StorageFile.owner_mailbox == mb.email
        )
    )
    vault_row = vault_result.first()
    vault_bytes = int(vault_row[0]) if vault_row else 0
    vault_files = int(vault_row[1]) if vault_row else 0

    total_combined_bytes = mb.bytes_used + vault_bytes
    percent = (total_combined_bytes / mb.quota_bytes * 100.0) if mb.quota_bytes > 0 else 0.0

    return MailboxStorageBreakdown(
        mailbox_id=mb.id,
        email=mb.email,
        quota_bytes=mb.quota_bytes,
        bytes_used=total_combined_bytes,
        messages_used=mb.messages_used,
        percent_used=round(min(100.0, percent), 1),
        folders=breakdown["folders"],
        vault_bytes=vault_bytes,
        vault_files=vault_files,
    )


@router.post("/{mailbox_id}/recalculate-usage", response_model=MailboxOut)
async def recalculate_mailbox_usage(
    mailbox_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    mailbox_repo = MailboxRepository(db)
    mb = await mailbox_repo.get_by_id(mailbox_id)
    if not mb:
        raise HTTPException(status_code=404, detail="Mailbox not found")

    stats = MailService.get_mailbox_usage(mb.maildir)
    mb.bytes_used = stats["bytes_used"]
    mb.messages_used = stats["messages_used"]
    await db.commit()
    await db.refresh(mb)
    return mb


@router.put("/{mailbox_id}", response_model=MailboxOut)
async def update_mailbox(
    mailbox_id: uuid.UUID,
    mb_update: MailboxUpdate,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    mailbox_repo = MailboxRepository(db)
    mb = await mailbox_repo.get_by_id(mailbox_id)
    if not mb:
        raise HTTPException(status_code=404, detail="Mailbox not found")

    if mb_update.full_name is not None:
        mb.full_name = mb_update.full_name
    if mb_update.password:
        mb.password_hash = get_password_hash(mb_update.password)
    if mb_update.quota_mb is not None:
        mb.quota_bytes = mb_update.quota_mb * 1024 * 1024
    if mb_update.department is not None:
        mb.department = mb_update.department
    if mb_update.is_active is not None:
        mb.is_active = mb_update.is_active
    if mb_update.is_admin is not None:
        mb.is_admin = mb_update.is_admin
    if mb_update.auto_reply_enabled is not None:
        mb.auto_reply_enabled = mb_update.auto_reply_enabled
    if mb_update.auto_reply_subject is not None:
        mb.auto_reply_subject = mb_update.auto_reply_subject
    if mb_update.auto_reply_body is not None:
        mb.auto_reply_body = mb_update.auto_reply_body
    if mb_update.signature is not None:
        mb.signature = mb_update.signature

    await log_action(
        db,
        actor=admin.username,
        action="UPDATE_MAILBOX",
        resource_type="mailbox",
        resource_id=str(mb.id),
        details={"email": mb.email}
    )
    await db.commit()
    return mb


@router.delete("/{mailbox_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mailbox(
    mailbox_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    mailbox_repo = MailboxRepository(db)
    mb = await mailbox_repo.get_by_id(mailbox_id)
    if not mb:
        raise HTTPException(status_code=404, detail="Mailbox not found")

    # Clean physical directory
    MailService.delete_mailbox_directory(mb.maildir)

    await mailbox_repo.delete(mb)
    await log_action(
        db,
        actor=admin.username,
        action="DELETE_MAILBOX",
        resource_type="mailbox",
        resource_id=str(mailbox_id),
        details={"email": mb.email}
    )
    await db.commit()
