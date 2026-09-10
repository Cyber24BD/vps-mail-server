import os
import json
import time
import asyncio
import email
import email.utils
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from email.message import EmailMessage
import smtplib

from fastapi import (
    APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Response
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.core.security import oauth2_scheme, decode_token
from app.models.models import Mailbox, Domain
from app.services.maildir_service import (
    MaildirService, register_event_listener, unregister_event_listener
)
from app.services.spam_service import SpamService

router = APIRouter()


# -------------------------------------------------------------------------
# Schemas
# -------------------------------------------------------------------------

class AttachmentInfo(BaseModel):
    index: int
    filename: str
    content_type: str
    size: int


class WebmailMessageOut(BaseModel):
    id: str
    folder: str
    sender: str
    recipient: str
    subject: str
    snippet: str
    body_text: Optional[str] = None
    body_html: Optional[str] = None
    date: str
    is_read: bool = False
    is_starred: bool = False
    has_attachment: bool = False
    attachments: Optional[List[AttachmentInfo]] = None
    cc: Optional[str] = None


class FolderStat(BaseModel):
    key: str
    name: str
    unread: int
    total: int


class MailboxStorageSummary(BaseModel):
    folders: List[FolderStat]
    bytes_used: int
    quota_bytes: int
    messages_used: int
    quota_percent: float


class MailboxAccountItem(BaseModel):
    email: str
    full_name: str
    quota_bytes: int
    bytes_used: int
    is_active: bool


class SpamCheckRequest(BaseModel):
    subject: str
    body_text: str
    body_html: Optional[str] = None
    attachment_names: Optional[List[str]] = None


class BulkActionRequest(BaseModel):
    action: str  # delete, move, mark_read, mark_unread, mark_spam, mark_ham
    message_ids: List[str]
    folder: str
    target_folder: Optional[str] = None


class MoveMessageRequest(BaseModel):
    target_folder: str


class SendEmailJsonRequest(BaseModel):
    recipient: str
    cc: Optional[str] = None
    bcc: Optional[str] = None
    subject: str
    body_text: str
    body_html: Optional[str] = None
    mailbox: Optional[str] = None


# -------------------------------------------------------------------------
# Authentication & Mailbox Context Helpers
# -------------------------------------------------------------------------

async def get_current_user_context(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
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

    # Default fallback for fresh setup before mailboxes created
    return "admin@corpmail.local"


# -------------------------------------------------------------------------
# Endpoints
# -------------------------------------------------------------------------

@router.get("/accounts", response_model=List[MailboxAccountItem])
async def list_available_accounts(
    user_ctx: Dict[str, Any] = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns list of mailboxes accessible by the logged-in user.
    Admins see all mailboxes; standard users see only their own.
    """
    try:
        if user_ctx["type"] == "mailbox":
            stmt = select(Mailbox).where(Mailbox.email == user_ctx["sub"].lower().strip())
            res = await db.execute(stmt)
            mb = res.scalar_one_or_none()
            if mb:
                return [MailboxAccountItem(
                    email=mb.email,
                    full_name=mb.full_name,
                    quota_bytes=mb.quota_bytes,
                    bytes_used=mb.bytes_used,
                    is_active=mb.is_active
                )]
            return [MailboxAccountItem(
                email=user_ctx["sub"],
                full_name=user_ctx["sub"].split("@")[0],
                quota_bytes=5368709120,
                bytes_used=0,
                is_active=True
            )]

        # Admin: return all mailboxes
        stmt = select(Mailbox).order_by(Mailbox.email.asc())
        res = await db.execute(stmt)
        mailboxes = res.scalars().all()
        if mailboxes:
            return [
                MailboxAccountItem(
                    email=m.email,
                    full_name=m.full_name,
                    quota_bytes=m.quota_bytes,
                    bytes_used=m.bytes_used,
                    is_active=m.is_active
                )
                for m in mailboxes
            ]
    except Exception:
        pass

    return [MailboxAccountItem(
        email="admin@corpmail.local",
        full_name="System Administrator",
        quota_bytes=10737418240,
        bytes_used=0,
        is_active=True
    )]


@router.get("/folders", response_model=MailboxStorageSummary)
async def get_folders(
    mailbox: Optional[str] = Query(None),
    user_ctx: Dict[str, Any] = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    active_mb = await resolve_active_mailbox(user_ctx, mailbox, db)
    mb_record = None
    quota_limit = 5368709120

    try:
        stmt = select(Mailbox).where(Mailbox.email == active_mb)
        res = await db.execute(stmt)
        mb_record = res.scalar_one_or_none()
        if mb_record:
            quota_limit = mb_record.quota_bytes
    except Exception:
        pass

    summary = MaildirService.get_mailbox_folders_summary(active_mb, quota_limit)

    # Sync storage stats in database
    if mb_record:
        try:
            mb_record.bytes_used = summary["bytes_used"]
            mb_record.messages_used = summary["messages_used"]
            await db.commit()
        except Exception:
            pass

    return summary


@router.get("/messages", response_model=List[WebmailMessageOut])
async def list_messages(
    folder: str = Query("inbox"),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    mailbox: Optional[str] = Query(None),
    user_ctx: Dict[str, Any] = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    active_mb = await resolve_active_mailbox(user_ctx, mailbox, db)
    messages = MaildirService.list_messages(
        mailbox_email=active_mb,
        folder_key=folder,
        search=search,
        limit=limit,
        offset=offset
    )

    # If folder is empty and it is inbox, inject welcome message once if needed
    if not messages and folder == "inbox" and offset == 0 and not search:
        MaildirService.inject_sample_email(active_mb, sample_type="welcome")
        messages = MaildirService.list_messages(
            mailbox_email=active_mb,
            folder_key=folder,
            limit=limit,
            offset=offset
        )

    return messages


@router.get("/messages/{message_id}", response_model=WebmailMessageOut)
async def get_message_detail(
    message_id: str,
    folder: str = Query("inbox"),
    mailbox: Optional[str] = Query(None),
    user_ctx: Dict[str, Any] = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    active_mb = await resolve_active_mailbox(user_ctx, mailbox, db)
    detail = MaildirService.get_message_detail(
        mailbox_email=active_mb,
        folder_key=folder,
        message_id=message_id,
        auto_mark_read=True
    )
    if not detail:
        raise HTTPException(status_code=404, detail="Message not found")
    return detail


@router.get("/messages/{message_id}/attachments/{index}")
async def download_attachment(
    message_id: str,
    index: int,
    folder: str = Query("inbox"),
    mailbox: Optional[str] = Query(None),
    user_ctx: Dict[str, Any] = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    active_mb = await resolve_active_mailbox(user_ctx, mailbox, db)
    result = MaildirService.get_attachment_bytes(
        mailbox_email=active_mb,
        folder_key=folder,
        message_id=message_id,
        attachment_index=index
    )
    if not result:
        raise HTTPException(status_code=404, detail="Attachment not found")

    payload, filename, content_type = result
    safe_name = filename.replace('"', '')
    return Response(
        content=payload,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'}
    )


@router.post("/spam-check")
async def check_outgoing_spam(
    req: SpamCheckRequest,
    user_ctx: Dict[str, Any] = Depends(get_current_user_context)
):
    """
    Pre-flight outgoing spam check returning risk score, trigger rules, and deliverability verdict.
    """
    result = SpamService.evaluate_outgoing_email(
        subject=req.subject,
        body_text=req.body_text,
        body_html=req.body_html,
        attachment_names=req.attachment_names,
        sender=user_ctx["sub"]
    )
    return result


@router.post("/send")
async def send_email(
    recipient: str = Form(...),
    subject: str = Form(...),
    body_text: str = Form(""),
    body_html: Optional[str] = Form(None),
    cc: Optional[str] = Form(None),
    bcc: Optional[str] = Form(None),
    mailbox: Optional[str] = Form(None),
    files: List[UploadFile] = File([]),
    user_ctx: Dict[str, Any] = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Sends email with rich HTML, attachments, spam verification, local delivery, and Sent folder sync.
    """
    active_mb = await resolve_active_mailbox(user_ctx, mailbox, db)

    # 1. Inspect outgoing spam heuristics
    attach_names = [f.filename for f in files if f.filename]
    spam_eval = SpamService.evaluate_outgoing_email(
        subject=subject,
        body_text=body_text,
        body_html=body_html,
        attachment_names=attach_names,
        sender=active_mb,
        recipient=recipient
    )

    if not spam_eval["is_safe"]:
        critical_triggers = [t["description"] for t in spam_eval["triggers"] if t.get("severity") in ("critical", "high")]
        detail_msg = f"Outgoing email blocked by Spam Filter (Score: {spam_eval['score']}/100): " + "; ".join(critical_triggers)
        raise HTTPException(status_code=400, detail=detail_msg)

    # 2. Build MIME Email
    msg = EmailMessage()
    msg["From"] = active_mb
    msg["To"] = recipient.strip()
    if cc and cc.strip():
        msg["Cc"] = cc.strip()
    msg["Subject"] = subject
    msg["Date"] = email.utils.formatdate(localtime=True)
    msg["Message-ID"] = email.utils.make_msgid(domain=settings.PRIMARY_HOSTNAME or "corpmail")
    msg["User-Agent"] = "Corporate Mail Platform Webmail/1.0"

    clean_text = body_text.strip() or " "
    msg.set_content(clean_text)

    if body_html and body_html.strip():
        msg.add_alternative(body_html, subtype="html")

    # Read and add attachments
    for upload in files:
        if upload.filename:
            file_bytes = await upload.read()
            maintype, _, subtype = (upload.content_type or "application/octet-stream").partition("/")
            msg.add_attachment(
                file_bytes,
                maintype=maintype or "application",
                subtype=subtype or "octet-stream",
                filename=upload.filename
            )

    raw_mime = msg.as_bytes()

    # 3. Save directly to Sender's Sent folder
    MaildirService.save_message(
        mailbox_email=active_mb,
        folder_key="sent",
        raw_mime_bytes=raw_mime,
        is_read=True
    )

    # 4. Check if recipient is a local mailbox on the platform (instant local delivery)
    recipients_to_deliver = [recipient.strip().lower()]
    if cc:
        recipients_to_deliver.extend([c.strip().lower() for c in cc.split(",") if c.strip()])

    for rec_addr in recipients_to_deliver:
        try:
            stmt = select(Mailbox).where(Mailbox.email == rec_addr)
            res = await db.execute(stmt)
            local_mb = res.scalar_one_or_none()
            if local_mb:
                MaildirService.save_message(
                    mailbox_email=rec_addr,
                    folder_key="inbox",
                    raw_mime_bytes=raw_mime,
                    is_read=False
                )
        except Exception:
            if "@" in rec_addr:
                MaildirService.save_message(rec_addr, "inbox", raw_mime, is_read=False)

    # 5. Dispatch via Postfix SMTP for external recipients
    smtp_dispatched = False
    if getattr(settings, "ENVIRONMENT", "") != "test":
        try:
            with smtplib.SMTP("postfix", 25, timeout=1) as server:
                server.send_message(msg)
                smtp_dispatched = True
        except Exception:
            pass

    return {
        "success": True,
        "message": "Email dispatched successfully and saved to Sent folder.",
        "spam_score": spam_eval["score"],
        "smtp_dispatched": smtp_dispatched
    }


@router.post("/send-json")
async def send_email_json(
    req: SendEmailJsonRequest,
    user_ctx: Dict[str, Any] = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    JSON alternative for sending email without multipart file attachments.
    """
    active_mb = await resolve_active_mailbox(user_ctx, req.mailbox, db)

    spam_eval = SpamService.evaluate_outgoing_email(
        subject=req.subject,
        body_text=req.body_text,
        body_html=req.body_html,
        sender=active_mb,
        recipient=req.recipient
    )

    if not spam_eval["is_safe"]:
        critical_triggers = [t["description"] for t in spam_eval["triggers"] if t.get("severity") in ("critical", "high")]
        detail_msg = f"Outgoing email blocked by Spam Filter (Score: {spam_eval['score']}/100): " + "; ".join(critical_triggers)
        raise HTTPException(status_code=400, detail=detail_msg)

    msg = EmailMessage()
    msg["From"] = active_mb
    msg["To"] = req.recipient.strip()
    if req.cc and req.cc.strip():
        msg["Cc"] = req.cc.strip()
    msg["Subject"] = req.subject
    msg["Date"] = email.utils.formatdate(localtime=True)
    msg["Message-ID"] = email.utils.make_msgid(domain=settings.PRIMARY_HOSTNAME or "corpmail")

    msg.set_content(req.body_text or " ")
    if req.body_html:
        msg.add_alternative(req.body_html, subtype="html")

    raw_mime = msg.as_bytes()

    # Save to Sent
    MaildirService.save_message(active_mb, "sent", raw_mime, is_read=True)

    # Local delivery check
    try:
        stmt = select(Mailbox).where(Mailbox.email == req.recipient.strip().lower())
        res = await db.execute(stmt)
        if res.scalar_one_or_none():
            MaildirService.save_message(req.recipient.strip().lower(), "inbox", raw_mime, is_read=False)
    except Exception:
        if "@" in req.recipient:
            MaildirService.save_message(req.recipient.strip().lower(), "inbox", raw_mime, is_read=False)

    if getattr(settings, "ENVIRONMENT", "") != "test":
        try:
            with smtplib.SMTP("postfix", 25, timeout=1) as server:
                server.send_message(msg)
        except Exception:
            pass

    return {
        "success": True,
        "message": "Email dispatched successfully and saved to Sent folder.",
        "spam_score": spam_eval["score"]
    }


@router.post("/messages/{message_id}/move")
async def move_message(
    message_id: str,
    req: MoveMessageRequest,
    folder: str = Query("inbox"),
    mailbox: Optional[str] = Query(None),
    user_ctx: Dict[str, Any] = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    active_mb = await resolve_active_mailbox(user_ctx, mailbox, db)
    success = MaildirService.move_message(
        mailbox_email=active_mb,
        from_folder=folder,
        to_folder=req.target_folder,
        message_id=message_id
    )
    if not success:
        raise HTTPException(status_code=400, detail="Failed to move message")
    return {"success": True, "message": f"Message moved to {req.target_folder}"}


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    folder: str = Query("inbox"),
    mailbox: Optional[str] = Query(None),
    user_ctx: Dict[str, Any] = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    active_mb = await resolve_active_mailbox(user_ctx, mailbox, db)
    success = MaildirService.delete_message(
        mailbox_email=active_mb,
        folder_key=folder,
        message_id=message_id
    )
    if not success:
        raise HTTPException(status_code=400, detail="Failed to delete message")
    action_desc = "permanently deleted" if folder.lower() == "trash" else "moved to Trash"
    return {"success": True, "message": f"Message {action_desc}"}


@router.post("/messages/{message_id}/mark-spam")
async def mark_message_as_spam(
    message_id: str,
    folder: str = Query("inbox"),
    mailbox: Optional[str] = Query(None),
    user_ctx: Dict[str, Any] = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    active_mb = await resolve_active_mailbox(user_ctx, mailbox, db)
    success = MaildirService.move_message(
        mailbox_email=active_mb,
        from_folder=folder,
        to_folder="spam",
        message_id=message_id
    )
    if not success:
        raise HTTPException(status_code=400, detail="Failed to mark message as spam")
    return {"success": True, "message": "Message moved to Spam folder and trained"}


@router.post("/messages/{message_id}/mark-ham")
async def mark_message_as_ham(
    message_id: str,
    mailbox: Optional[str] = Query(None),
    user_ctx: Dict[str, Any] = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    active_mb = await resolve_active_mailbox(user_ctx, mailbox, db)
    success = MaildirService.move_message(
        mailbox_email=active_mb,
        from_folder="spam",
        to_folder="inbox",
        message_id=message_id
    )
    if not success:
        raise HTTPException(status_code=400, detail="Failed to restore message from spam")
    return {"success": True, "message": "Message restored to Inbox"}


@router.post("/bulk")
async def execute_bulk_action(
    req: BulkActionRequest,
    mailbox: Optional[str] = Query(None),
    user_ctx: Dict[str, Any] = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    active_mb = await resolve_active_mailbox(user_ctx, mailbox, db)
    affected = MaildirService.execute_bulk_action(
        mailbox_email=active_mb,
        action=req.action,
        message_ids=req.message_ids,
        from_folder=req.folder,
        to_folder=req.target_folder
    )
    return {"success": True, "affected_count": affected}


@router.post("/test-delivery")
async def test_delivery(
    sample_type: str = Query("welcome"),
    mailbox: Optional[str] = Query(None),
    user_ctx: Dict[str, Any] = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Simulates / injects incoming email directly into inbox for end-to-end verification.
    """
    active_mb = await resolve_active_mailbox(user_ctx, mailbox, db)
    mid = MaildirService.inject_sample_email(active_mb, sample_type=sample_type)
    return {"success": True, "message": f"Test message injected into Inbox for {active_mb}", "message_id": mid}


@router.get("/events")
async def sse_mailbox_events(
    mailbox: Optional[str] = Query(None),
    user_ctx: Dict[str, Any] = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Server-Sent Events (SSE) stream for instant real-time incoming mail delivery notifications.
    """
    active_mb = await resolve_active_mailbox(user_ctx, mailbox, db)
    q = register_event_listener(active_mb)

    async def event_generator():
        try:
            # Send initial connection event
            yield f"event: connected\ndata: {json.dumps({'mailbox': active_mb, 'time': time.time()})}\n\n"
            while True:
                try:
                    # Wait up to 15 seconds for an event or send keepalive comment
                    item = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield f"event: {item['event']}\ndata: {json.dumps(item['data'])}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            unregister_event_listener(active_mb, q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
