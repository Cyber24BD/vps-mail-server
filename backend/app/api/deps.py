from typing import Optional, List
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import oauth2_scheme, decode_token
from app.repositories.admin_repo import AdminRepository
from app.models.models import Administrator, AuditLog


async def get_current_admin(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> Administrator:
    payload = decode_token(token)
    username: Optional[str] = payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token payload"
        )
    admin_repo = AdminRepository(db)
    admin = await admin_repo.get_by_username(username)
    if not admin or not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Administrator account not found or deactivated"
        )
    return admin


def require_roles(allowed_roles: List[str]):
    async def role_checker(current_admin: Administrator = Depends(get_current_admin)) -> Administrator:
        if current_admin.role not in allowed_roles and current_admin.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient administrative permissions"
            )
        return current_admin
    return role_checker


async def log_action(
    db: AsyncSession,
    actor: str,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    details: Optional[dict] = None,
    ip: Optional[str] = None
) -> None:
    log_entry = AuditLog(
        actor=actor,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip
    )
    db.add(log_entry)
    await db.flush()
