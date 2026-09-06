from datetime import timedelta, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.core.config import settings
from app.repositories.admin_repo import AdminRepository
from app.repositories.mailbox_repo import MailboxRepository
from app.schemas.auth import Token, AdminOut
from app.api.deps import get_current_admin, log_action

router = APIRouter()


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    admin_repo = AdminRepository(db)
    mailbox_repo = MailboxRepository(db)

    # 1. Check if login matches an administrator
    admin = await admin_repo.get_by_username(form_data.username)
    if admin and verify_password(form_data.password, admin.password_hash):
        if not admin.is_active:
            raise HTTPException(status_code=400, detail="Administrator account is inactive")
        admin.last_login = datetime.now(timezone.utc)
        await db.commit()

        token = create_access_token(
            data={"sub": admin.username, "role": admin.role, "type": "admin"},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        return Token(access_token=token, token_type="bearer", role=admin.role, username=admin.username)

    # 2. Check if login matches a mailbox user (for Webmail login)
    mailbox = await mailbox_repo.get_by_email(form_data.username)
    if mailbox and verify_password(form_data.password, mailbox.password_hash):
        if not mailbox.is_active:
            raise HTTPException(status_code=400, detail="Mailbox account is suspended")
        token = create_access_token(
            data={"sub": mailbox.email, "role": "user", "type": "mailbox"},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        return Token(access_token=token, token_type="bearer", role="user", username=mailbox.email)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect username or password",
        headers={"WWW-Authenticate": "Bearer"},
    )


@router.get("/me", response_model=AdminOut)
async def get_me(current_admin = Depends(get_current_admin)):
    return current_admin
