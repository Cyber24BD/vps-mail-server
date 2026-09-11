from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    bootstrap,
    domains,
    mailboxes,
    aliases,
    groups,
    diagnostics,
    security,
    backups,
    logs,
    webmail,
    settings as settings_endpoint,
)

from app.core.config import settings

from app.api.v1.endpoints import updates

api_router = APIRouter()

# Core Required Services
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(bootstrap.router, prefix="/bootstrap", tags=["Bootstrap & Wizard"])
api_router.include_router(domains.router, prefix="/domains", tags=["Domains & DNS"])
api_router.include_router(mailboxes.router, prefix="/mailboxes", tags=["Mailboxes & Quotas"])
api_router.include_router(security.router, prefix="/security", tags=["Security & SSL"])
api_router.include_router(settings_endpoint.router, prefix="/settings", tags=["System Settings"])
api_router.include_router(updates.router, prefix="/updates", tags=["Platform Updates"])
api_router.include_router(logs.router, prefix="/logs", tags=["Audit Logs"])


# Modular Optional Services (Toggleable via environment)
if settings.ENABLE_ALIASES:
    api_router.include_router(aliases.router, prefix="/aliases", tags=["Email Aliases"])
    api_router.include_router(groups.router, prefix="/groups", tags=["Mailing Groups"])

if settings.ENABLE_DIAGNOSTICS:
    api_router.include_router(diagnostics.router, prefix="/diagnostics", tags=["System Diagnostics"])

if settings.ENABLE_BACKUPS:
    api_router.include_router(backups.router, prefix="/backups", tags=["Backups"])

if settings.ENABLE_WEBMAIL:
    api_router.include_router(webmail.router, prefix="/webmail", tags=["Webmail Client"])

