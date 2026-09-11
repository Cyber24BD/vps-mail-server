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
        folders = ["inbox", "Sent", "Drafts", "Trash", "Spam", "Archive", ".Sent", ".Drafts", ".Trash", ".Spam", ".Archive"]
        for f in folders:
            folder_dir = full_path if f == "inbox" else os.path.join(full_path, f)
            for sub in ["cur", "new", "tmp"]:
                os.makedirs(os.path.join(folder_dir, sub), exist_ok=True)

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
    def get_mailbox_folder_breakdown(maildir_relative: str) -> Dict[str, Any]:
        """
        Calculates disk usage and message counts broken down by Maildir folders:
        Inbox (cur/new), Sent (.Sent), Trash (.Trash), Junk/Spam (.Junk/.Spam), Drafts (.Drafts), Other.
        """
        full_path = os.path.join(settings.VMAIL_DIR, maildir_relative)
        folders_map: Dict[str, Dict[str, int]] = {
            "Inbox": {"bytes_used": 0, "messages_count": 0},
            "Sent": {"bytes_used": 0, "messages_count": 0},
            "Trash": {"bytes_used": 0, "messages_count": 0},
            "Junk": {"bytes_used": 0, "messages_count": 0},
            "Drafts": {"bytes_used": 0, "messages_count": 0},
            "Archive / Other": {"bytes_used": 0, "messages_count": 0},
        }

        if not os.path.exists(full_path):
            return {
                "total_bytes": 0,
                "total_messages": 0,
                "folders": [{"name": k, **v} for k, v in folders_map.items()]
            }

        total_bytes = 0
        total_messages = 0

        try:
            for entry in os.scandir(full_path):
                if entry.is_dir():
                    folder_name = entry.name
                    target_category = "Archive / Other"
                    if folder_name in ("cur", "new", "tmp"):
                        target_category = "Inbox"
                    elif folder_name in (".Sent", ".Sent Items", "Sent"):
                        target_category = "Sent"
                    elif folder_name in (".Trash", "Trash"):
                        target_category = "Trash"
                    elif folder_name in (".Junk", ".Spam", "Junk", "Spam"):
                        target_category = "Junk"
                    elif folder_name in (".Drafts", "Drafts"):
                        target_category = "Drafts"

                    for sub_root, _, sub_files in os.walk(entry.path):
                        for f in sub_files:
                            fp = os.path.join(sub_root, f)
                            try:
                                sz = os.path.getsize(fp)
                                folders_map[target_category]["bytes_used"] += sz
                                folders_map[target_category]["messages_count"] += 1
                                total_bytes += sz
                                total_messages += 1
                            except OSError:
                                pass
        except Exception:
            pass

        return {
            "total_bytes": total_bytes,
            "total_messages": total_messages,
            "folders": [{"name": k, **v} for k, v in folders_map.items()]
        }

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
