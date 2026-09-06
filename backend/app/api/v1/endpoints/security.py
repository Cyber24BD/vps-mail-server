from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from app.services.security_service import SecurityService
from app.api.deps import get_current_admin

router = APIRouter()


class SslIssueRequest(BaseModel):
    domain: str
    admin_email: EmailStr


@router.get("/ssl")
async def get_ssl_status(
    domain: str = Query(..., description="Mail domain name to inspect"),
    admin = Depends(get_current_admin)
):
    return SecurityService.get_ssl_certificate_status(domain)


@router.post("/ssl/issue")
async def issue_ssl_certificate(
    req: SslIssueRequest,
    admin = Depends(get_current_admin)
):
    result = SecurityService.issue_letsencrypt_certificate(req.domain, req.admin_email)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@router.get("/fail2ban")
async def get_fail2ban_status(admin = Depends(get_current_admin)):
    return SecurityService.get_fail2ban_status()
