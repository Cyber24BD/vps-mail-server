import os
import re
import time
import uuid
import email
from email.policy import default
from email.message import EmailMessage
from email.header import decode_header, make_header
from datetime import datetime, timezone
import asyncio
from typing import Dict, Any, List, Optional, Tuple
from app.core.config import settings


def decode_mime_header(val: Any) -> str:
    """
    Decodes RFC 2047 MIME encoded words (e.g. =?UTF-8?B?...?= or =?ISO-8859-1?Q?...?=)
    into clean, human-readable Unicode text.
    """
    if not val:
        return ""
    val_str = str(val).strip()
    try:
        chunks = decode_header(val_str)
        parts = []
        for text, charset in chunks:
            if isinstance(text, bytes):
                enc = charset or "utf-8"
                try:
                    parts.append(text.decode(enc, errors="replace"))
                except (LookupError, UnicodeDecodeError):
                    parts.append(text.decode("latin1", errors="replace"))
            else:
                parts.append(str(text))
        return " ".join("".join(parts).split())
    except Exception:
        return val_str


# In-memory event queues for real-time SSE updates
_EVENT_QUEUES: Dict[str, List[asyncio.Queue]] = {}

# Flag delimiters: standard ':2,' on POSIX, portable ';2,' on Windows
FLAG_DELIM = ":2," if os.name != "nt" else ";2,"
KNOWN_SEPARATORS = [":2,", ";2,", "!2,"]


def has_flag(filename: str, flag: str) -> bool:
    for sep in KNOWN_SEPARATORS:
        if sep in filename:
            flags_part = filename.split(sep)[-1]
            return flag in flags_part
    return False


def split_flags(filename: str) -> Tuple[str, str]:
    for sep in KNOWN_SEPARATORS:
        if sep in filename:
            parts = filename.split(sep, 1)
            return parts[0], parts[1]
    return filename, ""


def format_filename_with_flags(base_name: str, flags: str) -> str:
    clean_flags = "".join(sorted(set(flags)))
    return f"{base_name}{FLAG_DELIM}{clean_flags}" if clean_flags else base_name


def register_event_listener(mailbox_email: str) -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue()
    email_key = mailbox_email.lower().strip()
    if email_key not in _EVENT_QUEUES:
        _EVENT_QUEUES[email_key] = []
    _EVENT_QUEUES[email_key].append(q)
    return q


def unregister_event_listener(mailbox_email: str, q: asyncio.Queue):
    email_key = mailbox_email.lower().strip()
    if email_key in _EVENT_QUEUES and q in _EVENT_QUEUES[email_key]:
        _EVENT_QUEUES[email_key].remove(q)
        if not _EVENT_QUEUES[email_key]:
            del _EVENT_QUEUES[email_key]


def broadcast_mailbox_event(mailbox_email: str, event_type: str, data: Dict[str, Any]):
    email_key = mailbox_email.lower().strip()
    if email_key in _EVENT_QUEUES:
        msg = {"event": event_type, "data": data, "timestamp": time.time()}
        for q in list(_EVENT_QUEUES[email_key]):
            try:
                q.put_nowait(msg)
            except Exception:
                pass


class MaildirService:
    """
    High-performance Maildir storage and MIME parsing engine.
    Compatible with Dovecot LAYOUT=fs and standard dot folders.
    Works seamlessly across Linux VPS and local development environments.
    """

    FOLDER_NAMES = {
        "inbox": "Inbox",
        "sent": "Sent",
        "drafts": "Drafts",
        "spam": "Spam",
        "trash": "Trash",
        "archive": "Archive"
    }

    @classmethod
    def get_mailbox_base_path(cls, mailbox_email: str) -> str:
        """
        Returns absolute root path to user's Maildir directory.
        e.g., /var/mail-platform/vmail/example.com/username
        """
        email_clean = mailbox_email.strip().lower()
        if "@" in email_clean:
            user, domain = email_clean.split("@", 1)
        else:
            user = email_clean
            domain = "default"
        return os.path.join(settings.VMAIL_DIR, domain, user)

    @classmethod
    def resolve_folder_paths(cls, base_path: str, folder_key: str) -> Tuple[str, str, str]:
        """
        Resolves (cur_path, new_path, tmp_path) for any folder.
        Handles both LAYOUT=fs (e.g. Sent/cur) and standard dot layout (.Sent/cur).
        """
        folder_key = folder_key.lower().strip()
        if folder_key in ("inbox", ""):
            folder_root = base_path
        else:
            std_name = cls.FOLDER_NAMES.get(folder_key, folder_key.capitalize())
            fs_path = os.path.join(base_path, std_name)
            dot_path = os.path.join(base_path, f".{std_name}")
            if os.path.isdir(dot_path) and not os.path.isdir(fs_path):
                folder_root = dot_path
            else:
                folder_root = fs_path

        cur_p = os.path.join(folder_root, "cur")
        new_p = os.path.join(folder_root, "new")
        tmp_p = os.path.join(folder_root, "tmp")

        for d in [cur_p, new_p, tmp_p]:
            try:
                os.makedirs(d, exist_ok=True)
            except Exception:
                pass

        return cur_p, new_p, tmp_p

    @classmethod
    def provision_all_folders(cls, mailbox_email: str):
        base_path = cls.get_mailbox_base_path(mailbox_email)
        for fkey in cls.FOLDER_NAMES.keys():
            cls.resolve_folder_paths(base_path, fkey)

        if hasattr(os, "chown"):
            try:
                for root, dirs, files in os.walk(base_path):
                    for d in dirs:
                        os.chown(os.path.join(root, d), 5000, 5000)
                    for f in files:
                        os.chown(os.path.join(root, f), 5000, 5000)
                os.chown(base_path, 5000, 5000)
            except Exception:
                pass

    @classmethod
    def get_mailbox_folders_summary(cls, mailbox_email: str, quota_bytes: int = 5368709120) -> Dict[str, Any]:
        """
        Calculates accurate message count, unread count, and disk storage usage.
        """
        base_path = cls.get_mailbox_base_path(mailbox_email)
        cls.provision_all_folders(mailbox_email)

        folders_result = []
        total_bytes = 0
        total_messages = 0

        for fkey, fname in cls.FOLDER_NAMES.items():
            cur_p, new_p, _ = cls.resolve_folder_paths(base_path, fkey)
            folder_unread = 0
            folder_total = 0

            # Count 'new' (all files in new/ are unread)
            if os.path.isdir(new_p):
                for fn in os.listdir(new_p):
                    fp = os.path.join(new_p, fn)
                    if os.path.isfile(fp):
                        folder_unread += 1
                        folder_total += 1
                        try:
                            total_bytes += os.path.getsize(fp)
                        except OSError:
                            pass

            # Count 'cur'
            if os.path.isdir(cur_p):
                for fn in os.listdir(cur_p):
                    fp = os.path.join(cur_p, fn)
                    if os.path.isfile(fp):
                        folder_total += 1
                        if not has_flag(fn, "S"):
                            folder_unread += 1
                        try:
                            total_bytes += os.path.getsize(fp)
                        except OSError:
                            pass

            total_messages += folder_total
            folders_result.append({
                "key": fkey,
                "name": fname,
                "unread": folder_unread,
                "total": folder_total
            })

        quota_percent = round((total_bytes / quota_bytes) * 100, 1) if quota_bytes > 0 else 0.0

        return {
            "folders": folders_result,
            "bytes_used": total_bytes,
            "quota_bytes": quota_bytes,
            "messages_used": total_messages,
            "quota_percent": min(100.0, quota_percent)
        }

    @classmethod
    def list_messages(
        cls,
        mailbox_email: str,
        folder_key: str = "inbox",
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Lists messages from new/ and cur/ directories, parsed with snippets.
        """
        base_path = cls.get_mailbox_base_path(mailbox_email)
        cur_p, new_p, _ = cls.resolve_folder_paths(base_path, folder_key)

        file_entries: List[Tuple[str, str, float]] = []

        if os.path.isdir(new_p):
            for fn in os.listdir(new_p):
                fp = os.path.join(new_p, fn)
                if os.path.isfile(fp):
                    try:
                        file_entries.append((fp, fn, os.path.getmtime(fp)))
                    except OSError:
                        pass

        if os.path.isdir(cur_p):
            for fn in os.listdir(cur_p):
                fp = os.path.join(cur_p, fn)
                if os.path.isfile(fp):
                    try:
                        file_entries.append((fp, fn, os.path.getmtime(fp)))
                    except OSError:
                        pass

        file_entries.sort(key=lambda x: x[2], reverse=True)

        messages = []
        search_lower = search.lower().strip() if search else None

        for fp, fn, mtime in file_entries:
            try:
                with open(fp, "rb") as f:
                    msg = email.message_from_binary_file(f, policy=default)

                sender = decode_mime_header(msg.get("from")) or "Unknown Sender"
                recipient = decode_mime_header(msg.get("to")) or mailbox_email
                subject = decode_mime_header(msg.get("subject")) or "(No Subject)"
                date_str = msg.get("date")

                try:
                    date_val = email.utils.parsedate_to_datetime(date_str) if date_str else datetime.fromtimestamp(mtime, tz=timezone.utc)
                except Exception:
                    date_val = datetime.fromtimestamp(mtime, tz=timezone.utc)

                has_attachment = False
                snippet = ""
                for part in msg.walk():
                    content_disp = str(part.get("Content-Disposition", ""))
                    if "attachment" in content_disp or part.get_filename():
                        has_attachment = True
                    if part.get_content_type() == "text/plain" and not snippet:
                        try:
                            payload = part.get_payload(decode=True)
                            if payload:
                                snippet = payload.decode(part.get_content_charset() or "utf-8", errors="replace")[:120].strip()
                        except Exception:
                            pass

                if not snippet:
                    for part in msg.walk():
                        if part.get_content_type() == "text/html":
                            try:
                                payload = part.get_payload(decode=True)
                                if payload:
                                    raw_html = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
                                    clean_text = re.sub(r"<[^>]+>", " ", raw_html)
                                    snippet = " ".join(clean_text.split())[:120]
                            except Exception:
                                pass

                is_in_new = "/new" in fp.replace("\\", "/")
                is_read = (not is_in_new) and has_flag(fn, "S")
                is_starred = has_flag(fn, "F")
                is_internal = (
                    msg.get("X-CorpMail-Delivery") == "Internal-Direct" or
                    msg.get("X-CorpMail-Internal") == "true"
                )

                if search_lower:
                    searchable = f"{sender} {subject} {snippet} {recipient}".lower()
                    if search_lower not in searchable:
                        continue

                messages.append({
                    "id": fn,
                    "folder": folder_key,
                    "sender": sender,
                    "recipient": recipient,
                    "subject": subject,
                    "snippet": snippet or "(Empty message)",
                    "date": date_val.isoformat(),
                    "is_read": is_read,
                    "is_starred": is_starred,
                    "is_internal": is_internal,
                    "has_attachment": has_attachment
                })
            except Exception:
                continue

        return messages[offset:offset + limit]

    @classmethod
    def _find_message_file(cls, cur_p: str, new_p: str, message_id: str) -> Tuple[Optional[str], bool]:
        """
        Locates a message file in cur/ or new/. Matches exact name or base name.
        Returns (file_path, is_in_new).
        """
        req_base, _ = split_flags(message_id)

        # 1. Direct file check
        for d, in_new in [(new_p, True), (cur_p, False)]:
            target = os.path.join(d, message_id)
            if os.path.isfile(target):
                return target, in_new

        # 2. Base name match in new/
        if os.path.isdir(new_p):
            for fn in os.listdir(new_p):
                fn_base, _ = split_flags(fn)
                if fn_base == req_base:
                    return os.path.join(new_p, fn), True

        # 3. Base name match in cur/
        if os.path.isdir(cur_p):
            for fn in os.listdir(cur_p):
                fn_base, _ = split_flags(fn)
                if fn_base == req_base:
                    return os.path.join(cur_p, fn), False

        return None, False

    @classmethod
    def get_message_detail(
        cls,
        mailbox_email: str,
        folder_key: str,
        message_id: str,
        auto_mark_read: bool = True
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieves full message detail with body, HTML, attachments, and marks as read.
        """
        base_path = cls.get_mailbox_base_path(mailbox_email)
        cur_p, new_p, _ = cls.resolve_folder_paths(base_path, folder_key)

        file_path, current_in_new = cls._find_message_file(cur_p, new_p, message_id)
        if not file_path:
            return None

        actual_filename = os.path.basename(file_path)

        with open(file_path, "rb") as f:
            msg = email.message_from_binary_file(f, policy=default)

        body_text = ""
        body_html = ""
        attachments = []

        attach_idx = 0
        for part in msg.walk():
            ctype = part.get_content_type()
            cdisp = str(part.get("Content-Disposition", ""))
            filename = part.get_filename()

            if "attachment" in cdisp or filename:
                payload = part.get_payload(decode=True)
                size_bytes = len(payload) if payload else 0
                safe_name = filename or f"attachment_{attach_idx + 1}.bin"
                attachments.append({
                    "index": attach_idx,
                    "filename": safe_name,
                    "content_type": ctype,
                    "size": size_bytes
                })
                attach_idx += 1
            elif ctype == "text/plain" and not body_text:
                try:
                    payload = part.get_payload(decode=True)
                    if payload:
                        body_text = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
                except Exception:
                    pass
            elif ctype == "text/html" and not body_html:
                try:
                    payload = part.get_payload(decode=True)
                    if payload:
                        body_html = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
                except Exception:
                    pass

        new_id = actual_filename
        if auto_mark_read:
            base_name, flags = split_flags(actual_filename)
            new_flags = "".join(sorted(set(flags + "S")))
            new_id = format_filename_with_flags(base_name, new_flags)
            dest_path = os.path.join(cur_p, new_id)

            if file_path != dest_path:
                try:
                    os.rename(file_path, dest_path)
                    file_path = dest_path
                except OSError:
                    new_id = actual_filename

        date_str = msg.get("date")
        try:
            date_val = email.utils.parsedate_to_datetime(date_str) if date_str else datetime.now(timezone.utc)
        except Exception:
            date_val = datetime.now(timezone.utc)

        return {
            "id": new_id,
            "folder": folder_key,
            "sender": decode_mime_header(msg.get("from")) or "Unknown Sender",
            "recipient": decode_mime_header(msg.get("to")) or mailbox_email,
            "cc": decode_mime_header(msg.get("cc")) or "",
            "subject": decode_mime_header(msg.get("subject")) or "(No Subject)",
            "snippet": (body_text or body_html)[:120],
            "body_text": body_text,
            "body_html": body_html,
            "attachments": attachments,
            "date": date_val.isoformat(),
            "is_read": True,
            "is_internal": (
                msg.get("X-CorpMail-Delivery") == "Internal-Direct" or
                msg.get("X-CorpMail-Internal") == "true"
            ),
            "has_attachment": len(attachments) > 0
        }

    @classmethod
    def get_attachment_bytes(
        cls,
        mailbox_email: str,
        folder_key: str,
        message_id: str,
        attachment_index: int
    ) -> Optional[Tuple[bytes, str, str]]:
        """
        Returns (payload_bytes, filename, content_type) for download.
        """
        base_path = cls.get_mailbox_base_path(mailbox_email)
        cur_p, new_p, _ = cls.resolve_folder_paths(base_path, folder_key)

        file_path, _ = cls._find_message_file(cur_p, new_p, message_id)
        if not file_path:
            return None

        with open(file_path, "rb") as f:
            msg = email.message_from_binary_file(f, policy=default)

        current_idx = 0
        for part in msg.walk():
            cdisp = str(part.get("Content-Disposition", ""))
            filename = part.get_filename()
            if "attachment" in cdisp or filename:
                if current_idx == attachment_index:
                    payload = part.get_payload(decode=True) or b""
                    ctype = part.get_content_type() or "application/octet-stream"
                    safe_name = filename or f"attachment_{attachment_index + 1}.bin"
                    return payload, safe_name, ctype
                current_idx += 1

        return None

    @classmethod
    def save_message(
        cls,
        mailbox_email: str,
        folder_key: str,
        raw_mime_bytes: bytes,
        is_read: bool = False
    ) -> str:
        """
        Saves raw MIME message to the designated folder.
        """
        base_path = cls.get_mailbox_base_path(mailbox_email)
        cur_p, new_p, _ = cls.resolve_folder_paths(base_path, folder_key)

        timestamp = int(time.time())
        rand_id = uuid.uuid4().hex[:8]
        host = (settings.PRIMARY_HOSTNAME or "corpmail").replace(":", "_")
        base_name = f"{timestamp}.M{time.time_ns() % 1000000}P{os.getpid()}_{rand_id}.{host}"

        if is_read:
            filename = format_filename_with_flags(base_name, "S")
            target_path = os.path.join(cur_p, filename)
        else:
            filename = base_name
            target_path = os.path.join(new_p, filename)

        with open(target_path, "wb") as f:
            f.write(raw_mime_bytes)

        if hasattr(os, "chown"):
            try:
                os.chown(target_path, 5000, 5000)
            except Exception:
                pass

        # Extract subject and sender for rich real-time UI notification
        evt_subject = "(No Subject)"
        evt_sender = mailbox_email
        try:
            parsed_tmp = email.message_from_bytes(raw_mime_bytes, policy=default)
            evt_subject = decode_mime_header(parsed_tmp.get("subject")) or "(No Subject)"
            evt_sender = decode_mime_header(parsed_tmp.get("from")) or mailbox_email
        except Exception:
            pass

        broadcast_mailbox_event(mailbox_email, "new_mail", {
            "folder": folder_key,
            "message_id": filename,
            "subject": evt_subject,
            "sender": evt_sender,
            "date": datetime.now(timezone.utc).isoformat()
        })
        return filename

    @classmethod
    def save_draft(
        cls,
        mailbox_email: str,
        recipient: str,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None,
        cc: Optional[str] = None,
        bcc: Optional[str] = None,
        draft_id: Optional[str] = None
    ) -> str:
        """
        Saves or replaces a draft in the Drafts folder.
        If draft_id is provided, the previous draft message is cleanly removed.
        """
        if draft_id:
            try:
                cls.delete_message(mailbox_email, "drafts", draft_id)
            except Exception:
                pass

        msg = EmailMessage()
        msg["From"] = mailbox_email
        msg["To"] = recipient.strip() if recipient else ""
        if cc and cc.strip():
            msg["Cc"] = cc.strip()
        if bcc and bcc.strip():
            msg["Bcc"] = bcc.strip()
        msg["Subject"] = subject.strip() if subject else "(Draft)"
        msg["Date"] = email.utils.formatdate(localtime=True)

        msg.set_content(body_text or "")
        if body_html:
            msg.add_alternative(body_html, subtype="html")

        return cls.save_message(
            mailbox_email=mailbox_email,
            folder_key="drafts",
            raw_mime_bytes=msg.as_bytes(),
            is_read=True
        )

    @classmethod
    def move_message(
        cls,
        mailbox_email: str,
        from_folder: str,
        to_folder: str,
        message_id: str
    ) -> bool:
        """
        Moves message from one folder to another.
        """
        base_path = cls.get_mailbox_base_path(mailbox_email)
        src_cur, src_new, _ = cls.resolve_folder_paths(base_path, from_folder)
        dst_cur, _, _ = cls.resolve_folder_paths(base_path, to_folder)

        src_path, _ = cls._find_message_file(src_cur, src_new, message_id)
        if not src_path:
            return False

        base_name, flags = split_flags(os.path.basename(src_path))
        flags = flags or "S"
        dest_filename = format_filename_with_flags(base_name, flags)
        dst_path = os.path.join(dst_cur, dest_filename)

        try:
            os.rename(src_path, dst_path)
            broadcast_mailbox_event(mailbox_email, "message_moved", {
                "from": from_folder, "to": to_folder, "message_id": dest_filename
            })
            return True
        except OSError:
            return False

    @classmethod
    def delete_message(
        cls,
        mailbox_email: str,
        folder_key: str,
        message_id: str
    ) -> bool:
        """
        If already in 'trash', deletes permanently.
        If in another folder, moves to 'trash'.
        """
        folder_key = folder_key.lower().strip()
        if folder_key == "trash":
            base_path = cls.get_mailbox_base_path(mailbox_email)
            cur_p, new_p, _ = cls.resolve_folder_paths(base_path, "trash")
            src_path, _ = cls._find_message_file(cur_p, new_p, message_id)
            if src_path:
                try:
                    os.unlink(src_path)
                    broadcast_mailbox_event(mailbox_email, "message_deleted", {"folder": "trash", "message_id": message_id})
                    return True
                except OSError:
                    return False
            return False
        else:
            return cls.move_message(mailbox_email, folder_key, "trash", message_id)

    @classmethod
    def execute_bulk_action(
        cls,
        mailbox_email: str,
        action: str,
        message_ids: List[str],
        from_folder: str,
        to_folder: Optional[str] = None
    ) -> int:
        """
        Executes bulk operations: delete, move, mark_read, mark_unread, mark_spam, mark_ham.
        """
        affected = 0
        base_path = cls.get_mailbox_base_path(mailbox_email)
        cur_p, new_p, _ = cls.resolve_folder_paths(base_path, from_folder)

        for mid in message_ids:
            if action == "delete":
                if cls.delete_message(mailbox_email, from_folder, mid):
                    affected += 1
            elif action == "move" and to_folder:
                if cls.move_message(mailbox_email, from_folder, to_folder, mid):
                    affected += 1
            elif action == "mark_spam":
                if cls.move_message(mailbox_email, from_folder, "spam", mid):
                    affected += 1
            elif action == "mark_ham":
                if cls.move_message(mailbox_email, from_folder, "inbox", mid):
                    affected += 1
            elif action == "mark_read":
                src_path, _ = cls._find_message_file(cur_p, new_p, mid)
                if src_path:
                    base_name, flags = split_flags(os.path.basename(src_path))
                    new_flags = "".join(sorted(set(flags + "S")))
                    dst = os.path.join(cur_p, format_filename_with_flags(base_name, new_flags))
                    try:
                        os.rename(src_path, dst)
                        affected += 1
                    except OSError:
                        pass
            elif action == "mark_unread":
                src_path, _ = cls._find_message_file(cur_p, new_p, mid)
                if src_path:
                    base_name, flags = split_flags(os.path.basename(src_path))
                    new_flags = flags.replace("S", "")
                    dst = os.path.join(new_p, format_filename_with_flags(base_name, new_flags))
                    try:
                        os.rename(src_path, dst)
                        affected += 1
                    except OSError:
                        pass

        if affected > 0:
            broadcast_mailbox_event(mailbox_email, "bulk_action_completed", {
                "action": action, "count": affected, "folder": from_folder
            })
        return affected

    @classmethod
    def inject_sample_email(
        cls,
        mailbox_email: str,
        sample_type: str = "welcome"
    ) -> str:
        """
        Injects a realistic test email into Inbox for verification and testing.
        """
        msg = EmailMessage()
        msg["From"] = "IT Support <support@corpmail.local>"
        msg["To"] = mailbox_email
        msg["Date"] = email.utils.formatdate(localtime=True)

        if sample_type == "welcome":
            msg["Subject"] = "Welcome to your Corporate Webmail"
            msg.set_content(
                "Welcome to your corporate email system!\n\n"
                "Your mailbox is fully configured with IMAP/SMTP encryption, DKIM signing, and automated spam filtering.\n"
                "You can compose HTML messages, attach documents, and manage your folders with real-time sync.\n\n"
                "Best regards,\nCorporate IT Administration"
            )
            msg.add_alternative(
                """<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; margin: 0; padding: 24px; background-color: #F8F9FA;">
  <div style="max-width: 600px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px; padding: 28px;">
    <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #111827;">Corporate Mail Platform</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #4B5563;">
      Welcome to your self-hosted corporate mailbox! Your email account is active and protected with enterprise security protocols.
    </p>
    <div style="margin-top: 20px; padding: 12px; background: #EBFBEE; border: 1px solid #2B8A3E; border-radius: 8px; color: #1B5E20; font-size: 13px; font-weight: 600;">
      Mailbox Status: Online & Healthy
    </div>
  </div>
</body>
</html>""",
                subtype="html"
            )
        else:
            msg["Subject"] = f"Test Incoming Delivery ({datetime.now().strftime('%H:%M:%S')})"
            msg.set_content("This is a live test email dispatched to verify real-time incoming delivery.")

        raw_bytes = msg.as_bytes()
        return cls.save_message(mailbox_email, "inbox", raw_bytes, is_read=False)
