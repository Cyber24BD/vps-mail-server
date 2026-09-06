from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload
from app.models.models import Domain, DnsRecord, Mailbox, Alias, MailingGroup


class DomainRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, domain_id, load_records: bool = False) -> Optional[Domain]:
        stmt = select(Domain).where(Domain.id == domain_id)
        if load_records:
            stmt = stmt.options(selectinload(Domain.dns_records))
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_name(self, name: str) -> Optional[Domain]:
        result = await self.db.execute(select(Domain).where(Domain.name == name.lower().strip()))
        return result.scalars().first()

    async def list_all(self) -> List[Domain]:
        result = await self.db.execute(select(Domain).order_by(Domain.created_at.desc()))
        return list(result.scalars().all())

    async def count(self) -> int:
        result = await self.db.execute(select(func.count(Domain.id)))
        return result.scalar_one() or 0

    async def create(self, name: str, mail_hostname: str, dkim_priv: str, dkim_pub: str) -> Domain:
        domain = Domain(
            name=name.lower().strip(),
            mail_hostname=mail_hostname.lower().strip(),
            is_active=False,
            verification_status="pending",
            dkim_selector="mail",
            dkim_private_key=dkim_priv,
            dkim_public_key=dkim_pub
        )
        self.db.add(domain)
        await self.db.flush()
        return domain

    async def delete(self, domain: Domain) -> None:
        await self.db.delete(domain)
        await self.db.flush()

    async def update_status(self, domain: Domain, status: str, is_active: bool) -> None:
        domain.verification_status = status
        domain.is_active = is_active
        await self.db.flush()

    async def upsert_dns_record(self, domain_id, record_type: str, host: str, expected: str, detected: Optional[str], status: str, error: Optional[str]) -> DnsRecord:
        result = await self.db.execute(
            select(DnsRecord).where(
                DnsRecord.domain_id == domain_id,
                DnsRecord.record_type == record_type,
                DnsRecord.host == host
            )
        )
        record = result.scalars().first()
        if not record:
            record = DnsRecord(
                domain_id=domain_id,
                record_type=record_type,
                host=host,
                expected_value=expected,
                detected_value=detected,
                status=status,
                error_reason=error
            )
            self.db.add(record)
        else:
            record.expected_value = expected
            record.detected_value = detected
            record.status = status
            record.error_reason = error
        await self.db.flush()
        return record
