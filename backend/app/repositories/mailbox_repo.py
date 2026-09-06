from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.models import Mailbox, Alias, MailingGroup, MailingGroupMember
from app.core.security import get_password_hash


class MailboxRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # --- Mailbox Operations ---
    async def get_by_id(self, mailbox_id) -> Optional[Mailbox]:
        result = await self.db.execute(select(Mailbox).where(Mailbox.id == mailbox_id))
        return result.scalars().first()

    async def get_by_email(self, email: str) -> Optional[Mailbox]:
        result = await self.db.execute(select(Mailbox).where(Mailbox.email == email.lower().strip()))
        return result.scalars().first()

    async def list_by_domain(self, domain_id) -> List[Mailbox]:
        result = await self.db.execute(
            select(Mailbox).where(Mailbox.domain_id == domain_id).order_by(Mailbox.email.asc())
        )
        return list(result.scalars().all())

    async def list_all(self, limit: int = 100, offset: int = 0) -> List[Mailbox]:
        result = await self.db.execute(
            select(Mailbox).order_by(Mailbox.created_at.desc()).limit(limit).offset(offset)
        )
        return list(result.scalars().all())

    async def count(self) -> int:
        result = await self.db.execute(select(func.count(Mailbox.id)))
        return result.scalar_one() or 0

    async def create(
        self,
        domain_id,
        email: str,
        full_name: str,
        password: str,
        quota_bytes: int,
        department: Optional[str] = None,
        is_admin: bool = False
    ) -> Mailbox:
        email = email.lower().strip()
        username, domain_part = email.split("@")
        maildir = f"{domain_part}/{username}/"

        mailbox = Mailbox(
            domain_id=domain_id,
            email=email,
            username=username,
            full_name=full_name,
            password_hash=get_password_hash(password),
            maildir=maildir,
            quota_bytes=quota_bytes,
            department=department,
            is_admin=is_admin,
            is_active=True
        )
        self.db.add(mailbox)
        await self.db.flush()
        return mailbox

    async def delete(self, mailbox: Mailbox) -> None:
        await self.db.delete(mailbox)
        await self.db.flush()

    # --- Alias Operations ---
    async def create_alias(self, domain_id, source_email: str, destination_email: str) -> Alias:
        alias = Alias(
            domain_id=domain_id,
            source_email=source_email.lower().strip(),
            destination_email=destination_email.lower().strip(),
            is_active=True
        )
        self.db.add(alias)
        await self.db.flush()
        return alias

    async def list_aliases_by_domain(self, domain_id) -> List[Alias]:
        result = await self.db.execute(
            select(Alias).where(Alias.domain_id == domain_id).order_by(Alias.source_email.asc())
        )
        return list(result.scalars().all())

    async def list_all_aliases(self) -> List[Alias]:
        result = await self.db.execute(select(Alias).order_by(Alias.created_at.desc()))
        return list(result.scalars().all())

    async def delete_alias(self, alias_id) -> None:
        result = await self.db.execute(select(Alias).where(Alias.id == alias_id))
        alias = result.scalars().first()
        if alias:
            await self.db.delete(alias)
            await self.db.flush()

    # --- Group Operations ---
    async def create_group(self, domain_id, group_email: str, name: str, description: Optional[str], allow_external: bool) -> MailingGroup:
        group = MailingGroup(
            domain_id=domain_id,
            group_email=group_email.lower().strip(),
            name=name,
            description=description,
            allow_external=allow_external
        )
        self.db.add(group)
        await self.db.flush()
        return group

    async def list_groups_by_domain(self, domain_id) -> List[MailingGroup]:
        result = await self.db.execute(
            select(MailingGroup).where(MailingGroup.domain_id == domain_id).order_by(MailingGroup.group_email.asc())
        )
        return list(result.scalars().all())

    async def list_all_groups(self) -> List[MailingGroup]:
        result = await self.db.execute(select(MailingGroup).order_by(MailingGroup.created_at.desc()))
        return list(result.scalars().all())

    async def add_group_member(self, group_id, mailbox_id) -> MailingGroupMember:
        member = MailingGroupMember(group_id=group_id, mailbox_id=mailbox_id)
        self.db.add(member)
        await self.db.flush()
        return member
