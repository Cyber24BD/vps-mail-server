from typing import List
from fastapi import APIRouter, Depends, Query
from app.schemas.system import BackupOut
from app.services.backup_service import BackupService
from app.api.deps import get_current_admin

router = APIRouter()


@router.get("/", response_model=List[BackupOut])
async def list_backups(admin = Depends(get_current_admin)):
    return BackupService.list_backups()


@router.post("/", response_model=BackupOut)
async def create_backup(
    backup_type: str = Query("full", enum=["full", "database"]),
    admin = Depends(get_current_admin)
):
    return BackupService.create_backup(backup_type)
