import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.repositories.domain_repo import DomainRepository
from app.repositories.mailbox_repo import MailboxRepository
from app.schemas.alias_group import AliasCreate, AliasOut
from app.api.deps import get_current_admin, log_action

router = APIRouter()


@router.get("/", response_model=List[AliasOut])
async def list_aliases(
    domain_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    mailbox_repo = MailboxRepository(db)
    if domain_id:
        return await mailbox_repo.list_aliases_by_domain(domain_id)
    return await mailbox_repo.list_all_aliases()


@router.post("/", response_model=AliasOut)
async def create_alias(
    alias_in: AliasCreate,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    domain_repo = DomainRepository(db)
    mailbox_repo = MailboxRepository(db)

    domain = await domain_repo.get_by_id(alias_in.domain_id)
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    src = alias_in.source_email.lower().strip()
    if not src.endswith(f"@{domain.name}"):
        raise HTTPException(status_code=400, detail=f"Source alias must end with @{domain.name}")

    alias = await mailbox_repo.create_alias(
        domain_id=domain.id,
        source_email=src,
        destination_email=alias_in.destination_email.lower().strip()
    )

    await log_action(
        db,
        actor=admin.username,
        action="CREATE_ALIAS",
        resource_type="alias",
        resource_id=str(alias.id),
        details={"source": src, "destination": alias.destination_email}
    )
    await db.commit()
    return alias


@router.delete("/{alias_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alias(
    alias_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    mailbox_repo = MailboxRepository(db)
    await mailbox_repo.delete_alias(alias_id)
    await log_action(
        db,
        actor=admin.username,
        action="DELETE_ALIAS",
        resource_type="alias",
        resource_id=str(alias_id)
    )
    await db.commit()
