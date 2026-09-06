import os
import shutil
import subprocess
from typing import Dict, Any, List
from app.core.config import settings


class MailService:
    @staticmethod
    def provision_mailbox_directory(maildir_relative: str) -> str:
        """
        Provisions Maildir structure: cur/, new/, tmp/
        Sets appropriate permissions for vmail UID:GID 5000
        """
        full_path = os.path.join(settings.VMAIL_DIR, maildir_relative)
        for sub in ["cur", "new", "tmp", ".Drafts", ".Sent", ".Trash", ".Junk", ".Archive"]:
            os.makedirs(os.path.join(full_path, sub), exist_ok=True)

        # On Linux VPS host, assign permissions to 5000:5000
        if hasattr(os, "chown"):
            try:
                for root, dirs, files in os.walk(full_path):
                    for d in dirs:
                        os.chown(os.path.join(root, d), 5000, 5000)
                    for f in files:
                        os.chown(os.path.join(root, f), 5000, 5000)
                os.chown(full_path, 5000, 5000)
            except Exception:
                pass
        return full_path

    @staticmethod
    def delete_mailbox_directory(maildir_relative: str) -> None:
        full_path = os.path.join(settings.VMAIL_DIR, maildir_relative)
        if os.path.exists(full_path):
            shutil.rmtree(full_path, ignore_errors=True)

    @staticmethod
    def get_mailbox_usage(maildir_relative: str) -> Dict[str, int]:
        """
        Calculates disk bytes used and message count inside a Maildir.
        """
        full_path = os.path.join(settings.VMAIL_DIR, maildir_relative)
        total_bytes = 0
        total_messages = 0

        if not os.path.exists(full_path):
            return {"bytes_used": 0, "messages_used": 0}

        try:
            for root, _, files in os.walk(full_path):
                for f in files:
                    fp = os.path.join(root, f)
                    try:
                        total_bytes += os.path.getsize(fp)
                        total_messages += 1
                    except OSError:
                        pass
        except Exception:
            pass

        return {"bytes_used": total_bytes, "messages_used": total_messages}

    @staticmethod
    def get_mail_queue_stats() -> Dict[str, Any]:
        """
        Reads Postfix mail queue statistics.
        Returns: {queue_count: int, items: List[Dict]}
        """
        # If running inside container with postqueue / mailq or via docker exec
        try:
            cmd = ["mailq"]
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=2)
            if "Mail queue is empty" in res.stdout:
                return {"queue_count": 0, "items": []}
            lines = res.stdout.strip().split("\n")
            return {"queue_count": max(0, len(lines) - 2), "raw": res.stdout[:500]}
        except Exception:
            return {"queue_count": 0, "items": []}
