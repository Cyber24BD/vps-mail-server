import os
import tarfile
from datetime import datetime, timezone
from typing import List, Dict, Any
from app.core.config import settings


class BackupService:
    @staticmethod
    def list_backups() -> List[Dict[str, Any]]:
        os.makedirs(settings.BACKUP_DIR, exist_ok=True)
        backups = []
        for f in os.listdir(settings.BACKUP_DIR):
            if f.endswith(".tar.gz") or f.endswith(".sql"):
                fp = os.path.join(settings.BACKUP_DIR, f)
                stat = os.stat(fp)
                backups.append({
                    "filename": f,
                    "size_mb": round(stat.st_size / (1024 * 1024), 2),
                    "created_at": datetime.fromtimestamp(stat.st_mtime, timezone.utc),
                    "backup_type": "full" if "full" in f else "database"
                })
        backups.sort(key=lambda x: x["created_at"], reverse=True)
        return backups

    @staticmethod
    def create_backup(backup_type: str = "full") -> Dict[str, Any]:
        os.makedirs(settings.BACKUP_DIR, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"backup_{backup_type}_{timestamp}.tar.gz"
        dest_path = os.path.join(settings.BACKUP_DIR, filename)

        with tarfile.open(dest_path, "w:gz") as tar:
            # Include configuration and metadata
            if os.path.exists(settings.DKIM_DIR):
                tar.add(settings.DKIM_DIR, arcname="dkim")
            if backup_type == "full" and os.path.exists(settings.VMAIL_DIR):
                tar.add(settings.VMAIL_DIR, arcname="vmail")

        stat = os.stat(dest_path)
        return {
            "filename": filename,
            "size_mb": round(stat.st_size / (1024 * 1024), 2),
            "created_at": datetime.now(timezone.utc),
            "backup_type": backup_type
        }
