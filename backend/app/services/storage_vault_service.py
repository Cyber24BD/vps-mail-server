import os
import re
import uuid
import hashlib
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone
from sqlalchemy import select, delete, func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.models.models import StorageFile, StorageFilePermission, Mailbox


class StorageVaultService:
    """
    Modular engine for zero-copy file storage, strict ACL permissions,
    real-time quota tracking, and automatic disk space reclamation.
    """

    CATEGORIES = {
        "images": ["image/"],
        "documents": [
            "application/pdf", "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "text/plain", "text/csv", "text/markdown", "application/json"
        ],
        "media": ["video/", "audio/"],
        "archives": [
            "application/zip", "application/x-tar", "application/gzip",
            "application/x-7z-compressed", "application/x-rar-compressed",
            "application/x-bzip2"
        ]
    }

    @classmethod
    def get_category_for_mimetype(cls, mime_type: str) -> str:
        clean_mime = (mime_type or "application/octet-stream").lower().strip()
        for cat, prefixes in cls.CATEGORIES.items():
            for p in prefixes:
                if clean_mime.startswith(p) if p.endswith("/") else clean_mime == p:
                    return cat
        return "others"

    @classmethod
    def get_user_storage_dir(cls, mailbox_email: str) -> str:
        """
        Returns absolute root path for user's storage vault.
        e.g. /var/mail-platform/vmail/toamun.com/username/storage
        """
        email_clean = mailbox_email.strip().lower()
        if "@" in email_clean:
            user, domain = email_clean.split("@", 1)
        else:
            user = email_clean
            domain = "default"

        storage_dir = os.path.join(settings.VMAIL_DIR, domain, user, "storage")
        os.makedirs(storage_dir, exist_ok=True)
        return storage_dir

    @classmethod
    async def store_attachment(
        cls,
        sender_mailbox: str,
        file_bytes: bytes,
        filename: str,
        content_type: Optional[str],
        db: AsyncSession,
        message_id: Optional[str] = None,
        subject: Optional[str] = None,
        source_type: str = "email_attachment"
    ) -> StorageFile:
        """
        Saves file safely to sender's vault, computes SHA256 checksum,
        and registers in storage_files.
        """
        storage_dir = cls.get_user_storage_dir(sender_mailbox)
        file_uuid = uuid.uuid4()
        
        # Sanitize filename & prevent path traversal
        raw_base = os.path.basename(filename) if filename else f"attachment_{file_uuid.hex[:8]}.bin"
        safe_name = re.sub(r'[^a-zA-Z0-9.\-_]', '_', raw_base)
        stored_filename = f"{file_uuid.hex}_{safe_name}"
        target_path = os.path.join(storage_dir, stored_filename)

        # Strict path traversal guard
        real_target = os.path.realpath(target_path)
        real_dir = os.path.realpath(storage_dir)
        if not real_target.startswith(real_dir):
            raise ValueError("Directory traversal attempt detected in filename")

        # Write to disk
        with open(target_path, "wb") as f:
            f.write(file_bytes)

        file_size = len(file_bytes)
        sha256_hash = hashlib.sha256(file_bytes).hexdigest()
        clean_mime = content_type or "application/octet-stream"

        storage_file = StorageFile(
            id=file_uuid,
            owner_mailbox=sender_mailbox.strip().lower(),
            filename=raw_base,
            filesize=file_size,
            content_type=clean_mime,
            file_path=target_path,
            sha256=sha256_hash,
            source_type=source_type,
            message_id=message_id,
            subject=subject
        )

        db.add(storage_file)
        await db.flush()

        # Update Mailbox bytes_used if mailbox exists
        try:
            stmt = select(Mailbox).where(Mailbox.email == sender_mailbox.strip().lower())
            res = await db.execute(stmt)
            mb = res.scalar_one_or_none()
            if mb:
                mb.bytes_used = (mb.bytes_used or 0) + file_size
        except Exception:
            pass

        return storage_file

    @classmethod
    async def grant_permissions(
        cls,
        file_id: uuid.UUID,
        recipient_emails: List[str],
        db: AsyncSession
    ) -> List[StorageFilePermission]:
        """
        Grants view/download permissions to internal recipients for zero-copy sharing.
        """
        granted = []
        for rec in recipient_emails:
            clean_rec = rec.strip().lower()
            if not clean_rec or "@" not in clean_rec:
                continue
            
            # Check if permission already exists
            stmt = select(StorageFilePermission).where(
                StorageFilePermission.file_id == file_id,
                StorageFilePermission.granted_to == clean_rec
            )
            res = await db.execute(stmt)
            existing = res.scalar_one_or_none()
            if not existing:
                perm = StorageFilePermission(
                    file_id=file_id,
                    granted_to=clean_rec,
                    permission="view_download"
                )
                db.add(perm)
                granted.append(perm)

        if granted:
            await db.flush()
        return granted

    @classmethod
    async def get_file_for_access(
        cls,
        file_id: str | uuid.UUID,
        requesting_mailbox: str,
        is_admin: bool,
        db: AsyncSession
    ) -> Optional[StorageFile]:
        """
        Enforces strict Access Control List (ACL):
        - Super admins: Allowed.
        - Owner: Allowed.
        - Granted recipient: Allowed.
        - Unauthorized users: Denied (returns None).
        """
        try:
            parsed_id = uuid.UUID(str(file_id))
        except ValueError:
            return None

        stmt = select(StorageFile).where(StorageFile.id == parsed_id).options(
            selectinload(StorageFile.permissions)
        )
        res = await db.execute(stmt)
        file_record = res.scalar_one_or_none()
        if not file_record:
            return None

        clean_requester = requesting_mailbox.strip().lower()

        if is_admin:
            return file_record

        if file_record.owner_mailbox.lower() == clean_requester:
            return file_record

        # Check if recipient permission granted
        for p in file_record.permissions:
            if p.granted_to.lower() == clean_requester:
                return file_record

        return None

    @classmethod
    async def delete_file(
        cls,
        file_id: str | uuid.UUID,
        requesting_mailbox: str,
        is_admin: bool,
        db: AsyncSession
    ) -> Tuple[bool, str]:
        """
        Deletes file from disk and database, cascading to permissions and freeing space.
        Only the owner or an admin can delete a file from storage.
        """
        try:
            parsed_id = uuid.UUID(str(file_id))
        except ValueError:
            return False, "Invalid file ID"

        stmt = select(StorageFile).where(StorageFile.id == parsed_id)
        res = await db.execute(stmt)
        file_record = res.scalar_one_or_none()
        if not file_record:
            return False, "File not found"

        clean_requester = requesting_mailbox.strip().lower()
        if not is_admin and file_record.owner_mailbox.lower() != clean_requester:
            return False, "Permission denied: Only the owner can delete this file"

        # Physically remove from disk
        if file_record.file_path and os.path.exists(file_record.file_path):
            try:
                os.remove(file_record.file_path)
            except Exception:
                pass

        file_size = file_record.filesize or 0
        owner_email = file_record.owner_mailbox

        # Remove from database
        await db.delete(file_record)
        await db.flush()

        # Deduct from owner's Mailbox bytes_used
        try:
            mb_stmt = select(Mailbox).where(Mailbox.email == owner_email)
            mb_res = await db.execute(mb_stmt)
            mb = mb_res.scalar_one_or_none()
            if mb and mb.bytes_used:
                mb.bytes_used = max(0, mb.bytes_used - file_size)
        except Exception:
            pass

        return True, "File deleted successfully and space reclaimed"

    @classmethod
    async def bulk_delete_files(
        cls,
        file_ids: List[str],
        requesting_mailbox: str,
        is_admin: bool,
        db: AsyncSession
    ) -> Dict[str, Any]:
        deleted_count = 0
        failed_count = 0

        for fid in file_ids:
            success, _ = await cls.delete_file(fid, requesting_mailbox, is_admin, db)
            if success:
                deleted_count += 1
            else:
                failed_count += 1

        return {
            "deleted_count": deleted_count,
            "failed_count": failed_count,
            "success": True
        }

    @classmethod
    async def list_user_files(
        cls,
        mailbox_email: str,
        category: Optional[str] = None,
        search: Optional[str] = None,
        sort_by: str = "date_desc",
        limit: int = 100,
        offset: int = 0,
        db: AsyncSession = None
    ) -> Dict[str, Any]:
        """
        Lists files owned by the user, with category filtering and search.
        """
        clean_email = mailbox_email.strip().lower()
        query = select(StorageFile).where(
            StorageFile.owner_mailbox == clean_email
        ).options(selectinload(StorageFile.permissions))

        # Filter by search
        if search:
            pattern = f"%{search.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(StorageFile.filename).like(pattern),
                    func.lower(StorageFile.subject).like(pattern)
                )
            )

        # Filter by category
        if category and category.lower() in cls.CATEGORIES:
            cat_filters = []
            for mime_prefix in cls.CATEGORIES[category.lower()]:
                if mime_prefix.endswith("/"):
                    cat_filters.append(StorageFile.content_type.like(f"{mime_prefix}%"))
                else:
                    cat_filters.append(StorageFile.content_type == mime_prefix)
            if cat_filters:
                query = query.where(or_(*cat_filters))

        # Sorting
        if sort_by == "size_desc":
            query = query.order_by(StorageFile.filesize.desc())
        elif sort_by == "size_asc":
            query = query.order_by(StorageFile.filesize.asc())
        elif sort_by == "name_asc":
            query = query.order_by(StorageFile.filename.asc())
        elif sort_by == "name_desc":
            query = query.order_by(StorageFile.filename.desc())
        elif sort_by == "date_asc":
            query = query.order_by(StorageFile.created_at.asc())
        else:  # default date_desc
            query = query.order_by(StorageFile.created_at.desc())

        # Total count query
        count_stmt = select(func.count(StorageFile.id)).where(StorageFile.owner_mailbox == clean_email)
        total_owned = (await db.execute(count_stmt)).scalar() or 0

        # Execute paginated query
        query = query.limit(limit).offset(offset)
        res = await db.execute(query)
        files = res.scalars().all()

        formatted_files = []
        for f in files:
            shared_with = [p.granted_to for p in f.permissions]
            formatted_files.append({
                "id": str(f.id),
                "filename": f.filename,
                "filesize": f.filesize,
                "content_type": f.content_type,
                "category": cls.get_category_for_mimetype(f.content_type),
                "sha256": f.sha256,
                "source_type": f.source_type,
                "message_id": f.message_id,
                "subject": f.subject,
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "shared_with": shared_with,
                "is_shared": len(shared_with) > 0
            })

        return {
            "total": total_owned,
            "files": formatted_files
        }

    @classmethod
    async def get_storage_stats(
        cls,
        mailbox_email: str,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Calculates quota, used space, and breakdown by file category.
        """
        clean_email = mailbox_email.strip().lower()

        # Mailbox quota
        quota_bytes = 5368709120  # Default 5GB
        mb_stmt = select(Mailbox).where(Mailbox.email == clean_email)
        mb_res = await db.execute(mb_stmt)
        mb = mb_res.scalar_one_or_none()
        if mb and mb.quota_bytes:
            quota_bytes = mb.quota_bytes

        # Query all files owned by user
        stmt = select(StorageFile.filesize, StorageFile.content_type).where(
            StorageFile.owner_mailbox == clean_email
        )
        res = await db.execute(stmt)
        rows = res.all()

        total_bytes = 0
        total_files = len(rows)
        breakdown = {
            "images": {"bytes": 0, "count": 0},
            "documents": {"bytes": 0, "count": 0},
            "media": {"bytes": 0, "count": 0},
            "archives": {"bytes": 0, "count": 0},
            "others": {"bytes": 0, "count": 0}
        }

        for size, ctype in rows:
            sz = size or 0
            total_bytes += sz
            cat = cls.get_category_for_mimetype(ctype or "")
            breakdown[cat]["bytes"] += sz
            breakdown[cat]["count"] += 1

        percent_used = round((total_bytes / quota_bytes * 100), 2) if quota_bytes > 0 else 0

        return {
            "mailbox_email": clean_email,
            "quota_bytes": quota_bytes,
            "total_bytes_used": total_bytes,
            "percent_used": percent_used,
            "total_files": total_files,
            "breakdown": breakdown
        }
