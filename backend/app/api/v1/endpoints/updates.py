from fastapi import APIRouter, Depends, HTTPException
from app.services.update_service import UpdateService
from app.api.deps import get_current_admin, log_action
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter()


@router.get("/check")
async def check_updates(admin = Depends(get_current_admin)):
    return await UpdateService.check_updates()


@router.post("/apply")
async def apply_update(
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    await log_action(
        db,
        actor=admin.username,
        action="TRIGGER_PLATFORM_UPDATE",
        resource_type="system",
        details={"source": "github"}
    )
    await db.commit()

    res = UpdateService.apply_update()
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error"))
    return res
