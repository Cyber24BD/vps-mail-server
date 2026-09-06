import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.repositories.domain_repo import DomainRepository
from app.repositories.mailbox_repo import MailboxRepository
from app.schemas.alias_group import GroupCreate, GroupOut
from app.api.deps import get_current_admin, log_action

router = APIRouter()


@router.get("/", response_model=List[GroupOut])
async def list_groups(
    domain_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    mailbox_repo = MailboxRepository(db)
    if domain_id:
        groups = await mailbox_repo.list_groups_by_domain(domain_id)
    else:
        groups = await mailbox_repo.list_all_groups()

    return [
        GroupOut(
            id=g.id,
            domain_id=g.domain_id,
            group_email=g.group_email,
            name=g.name,
            description=g.description,
            allow_external=g.allow_external,
            members_count=len(g.members) if hasattr(g, "members") and g.members else 0,
            created_at=g.created_at
        )
        for g in groups
    ]


@router.post("/", response_model=GroupOut)
async def create_group(
    group_in: GroupCreate,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    domain_repo = DomainRepository(db)
    mailbox_repo = MailboxRepository(db)

    domain = await domain_repo.get_by_id(group_in.domain_id)
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    grp_email = group_in.group_email.lower().strip()
    if not grp_email.endswith(f"@{domain.name}"):
        raise HTTPException(status_code=400, detail=f"Group email must end with @{domain.name}")

    group = await mailbox_repo.create_group(
        domain_id=domain.id,
        group_email=grp_email,
        name=group_in.name,
        description=group_in.description,
        allow_external=group_in.allow_external
    )

    for mb_id in group_in.member_mailbox_ids:
        await mailbox_repo.add_group_member(group.id, mb_id)

    await log_action(
        db,
        actor=admin.username,
        action="CREATE_GROUP",
        resource_type="group",
        resource_id=str(group.id),
        details={"group_email": grp_email, "members_count": len(group_in.member_mailbox_ids)}
    )
    await db.commit()

    return GroupOut(
        id=group.id,
        domain_id=group.domain_id,
        group_email=group.group_email,
        name=group.name,
        description=group.description,
        allow_external=group.allow_external,
        members_count=len(group_in.member_mailbox_ids),
        created_at=group.created_at
    )
