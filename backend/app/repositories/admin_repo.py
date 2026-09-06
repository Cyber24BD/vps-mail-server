from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.models import Administrator
from app.core.security import get_password_hash


class AdminRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, admin_id) -> Optional[Administrator]:
        result = await self.db.execute(select(Administrator).where(Administrator.id == admin_id))
        return result.scalars().first()

    async def get_by_username(self, username: str) -> Optional[Administrator]:
        result = await self.db.execute(select(Administrator).where(Administrator.username == username))
        return result.scalars().first()

    async def get_by_email(self, email: str) -> Optional[Administrator]:
        result = await self.db.execute(select(Administrator).where(Administrator.email == email))
        return result.scalars().first()

    async def count(self) -> int:
        result = await self.db.execute(select(func.count(Administrator.id)))
        return result.scalar_one() or 0

    async def create(self, username: str, email: str, password: str, role: str = "super_admin") -> Administrator:
        admin = Administrator(
            username=username,
            email=email,
            password_hash=get_password_hash(password),
            role=role,
            is_active=True
        )
        self.db.add(admin)
        await self.db.flush()
        return admin

    async def list_all(self) -> List[Administrator]:
        result = await self.db.execute(select(Administrator).order_by(Administrator.created_at.desc()))
        return list(result.scalars().all())

    async def update_password(self, admin: Administrator, new_password: str) -> Administrator:
        admin.password_hash = get_password_hash(new_password)
        await self.db.flush()
        return admin
