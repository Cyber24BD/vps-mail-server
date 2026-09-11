import os
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user_context, resolve_active_mailbox, log_action
from app.services.storage_vault_service import StorageVaultService

router = APIRouter()


class BulkDeleteRequest(BaseModel):
    file_ids: List[str]
    mailbox: Optional[str] = None


@router.get("/stats")
async def get_storage_statistics(
    mailbox: Optional[str] = Query(None),
    user_ctx: Dict[str, Any] = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves storage usage, quota, and category breakdown for active mailbox.
    """
    active_mb = await resolve_active_mailbox(user_ctx, mailbox, db)
    return await StorageVaultService.get_storage_stats(active_mb, db)


@router.get("/files")
async def list_storage_files(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("date_desc"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    mailbox: Optional[str] = Query(None),
    user_ctx: Dict[str, Any] = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Lists files owned by the user, with category filtering, search, and sorting.
    """
    active_mb = await resolve_active_mailbox(user_ctx, mailbox, db)
    return await StorageVaultService.list_user_files(
        mailbox_email=active_mb,
        category=category,
        search=search,
        sort_by=sort_by,
        limit=limit,
        offset=offset,
        db=db
    )


@router.get("/files/{file_id}/preview")
async def preview_storage_file(
    file_id: str,
    mailbox: Optional[str] = Query(None),
    user_ctx: Dict[str, Any] = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Streams file inline for preview if permitted by ACL (owner or granted recipient).
    """
    active_mb = await resolve_active_mailbox(user_ctx, mailbox, db)
    is_admin = user_ctx.get("role") == "super_admin"

    file_record = await StorageVaultService.get_file_for_access(
        file_id=file_id,
        requesting_mailbox=active_mb,
        is_admin=is_admin,
        db=db
    )
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied or file does not exist"
        )

    if not file_record.file_path or not os.path.exists(file_record.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The file content was deleted from storage to reclaim space"
        )

    safe_name = file_record.filename.replace('"', '')
    return FileResponse(
        path=file_record.file_path,
        media_type=file_record.content_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'inline; filename="{safe_name}"',
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline';",
            "X-Content-Type-Options": "nosniff"
        }
    )


@router.get("/files/{file_id}/download")
async def download_storage_file(
    file_id: str,
    mailbox: Optional[str] = Query(None),
    user_ctx: Dict[str, Any] = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Downloads file with Content-Disposition: attachment.
    """
    active_mb = await resolve_active_mailbox(user_ctx, mailbox, db)
    is_admin = user_ctx.get("role") == "super_admin"

    file_record = await StorageVaultService.get_file_for_access(
        file_id=file_id,
        requesting_mailbox=active_mb,
        is_admin=is_admin,
        db=db
    )
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied or file does not exist"
        )

    if not file_record.file_path or not os.path.exists(file_record.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The file content was deleted from storage to reclaim space"
        )

    return FileResponse(
        path=file_record.file_path,
        media_type=file_record.content_type or "application/octet-stream",
        filename=file_record.filename
    )


@router.delete("/files/{file_id}")
async def delete_storage_file(
    file_id: str,
    mailbox: Optional[str] = Query(None),
    user_ctx: Dict[str, Any] = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Permanently deletes a file from disk and database, cascading to permissions and reclaiming disk space.
    """
    active_mb = await resolve_active_mailbox(user_ctx, mailbox, db)
    is_admin = user_ctx.get("role") == "super_admin"

    success, message = await StorageVaultService.delete_file(
        file_id=file_id,
        requesting_mailbox=active_mb,
        is_admin=is_admin,
        db=db
    )
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

    await log_action(
        db=db,
        actor=active_mb,
        action="delete_storage_file",
        resource_type="storage_file",
        resource_id=file_id,
        details={"message": message}
    )

    return {"success": True, "message": message}


@router.post("/bulk-delete")
async def bulk_delete_storage_files(
    payload: BulkDeleteRequest,
    user_ctx: Dict[str, Any] = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Bulk deletes multiple files owned by the user.
    """
    active_mb = await resolve_active_mailbox(user_ctx, payload.mailbox, db)
    is_admin = user_ctx.get("role") == "super_admin"

    result = await StorageVaultService.bulk_delete_files(
        file_ids=payload.file_ids,
        requesting_mailbox=active_mb,
        is_admin=is_admin,
        db=db
    )

    await log_action(
        db=db,
        actor=active_mb,
        action="bulk_delete_storage_files",
        resource_type="storage_file",
        details={"deleted_count": result["deleted_count"]}
    )

    return result
