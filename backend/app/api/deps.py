from typing import Optional, List, Dict, Any
from fastapi import Depends, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import oauth2_scheme, decode_token
from app.repositories.admin_repo import AdminRepository
from app.models.models import Administrator, AuditLog, Mailbox


async def get_current_user_context(
    token_header: Optional[str] = Depends(oauth2_scheme),
    token_query: Optional[str] = Query(None, alias="token"),
) -> Dict[str, Any]:
    token = token_header or token_query
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(token)
    user = payload.get("sub")
    role = payload.get("role", "user")
    token_type = payload.get("type", "mailbox")
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session token")
    return {"sub": user, "role": role, "type": token_type}


async def resolve_active_mailbox(
    user_ctx: Dict[str, Any],
    requested_mailbox: Optional[str],
    db: AsyncSession
) -> str:
    """
    Enforces access control:
    - If user is a standard mailbox account, only allows their own email.
    - If user is an admin, allows selecting any active mailbox, or defaults to the first available mailbox.
    """
    if user_ctx["type"] == "mailbox":
        return user_ctx["sub"].lower().strip()

    # Admin context:
    if requested_mailbox:
        clean_req = requested_mailbox.lower().strip()
        try:
            stmt = select(Mailbox).where(Mailbox.email == clean_req)
            res = await db.execute(stmt)
            mb = res.scalar_one_or_none()
            if mb:
                return mb.email
        except Exception:
            pass
        return clean_req

    try:
        stmt = select(Mailbox).where(Mailbox.is_active.is_(True)).order_by(Mailbox.created_at.desc()).limit(1)
        res = await db.execute(stmt)
        mb = res.scalar_one_or_none()
        if mb:
            return mb.email
    except Exception:
        pass

    return user_ctx["sub"].lower().strip()



async def get_current_admin(
    token_header: Optional[str] = Depends(oauth2_scheme),
    token_query: Optional[str] = Query(None, alias="token"),
    db: AsyncSession = Depends(get_db)
) -> Administrator:
    token = token_header or token_query
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
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
