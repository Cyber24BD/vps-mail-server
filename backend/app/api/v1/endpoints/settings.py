from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_admin, log_action
from app.services.routing_service import MessageRoutingService

router = APIRouter()


class InternalMessagingSettingsIn(BaseModel):
    enabled: bool
    same_domain_only: bool = True
    stamp_internal_header: bool = True


class InternalMessagingSettingsOut(BaseModel):
    enabled: bool
    same_domain_only: bool
    stamp_internal_header: bool
    description: Optional[str] = None


@router.get("/internal-messaging", response_model=InternalMessagingSettingsOut)
async def get_internal_messaging_policy(
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """
    Retrieves the current status of Internal Domain Direct Messaging policy.
    """
    config = await MessageRoutingService.get_settings(db)
    return InternalMessagingSettingsOut(**config)


@router.post("/internal-messaging", response_model=InternalMessagingSettingsOut)
async def update_internal_messaging_policy(
    payload: InternalMessagingSettingsIn,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """
    Updates the Internal Domain Direct Messaging policy (Admin only).
    """
    updated = await MessageRoutingService.update_settings(
        enabled=payload.enabled,
        same_domain_only=payload.same_domain_only,
        stamp_internal_header=payload.stamp_internal_header,
        db=db
    )

    await log_action(
        db=db,
        actor=admin.username,
        action="update_policy",
        resource_type="system_setting",
        resource_id="internal_direct_messaging_enabled",
        details=updated
    )

    return InternalMessagingSettingsOut(**updated)
