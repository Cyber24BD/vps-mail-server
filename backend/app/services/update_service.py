import subprocess
from typing import Dict, Any
import httpx


class UpdateService:
    REPO_API_URL = "https://api.github.com/repos/Cyber24BD/vps-mail-server/commits/main"

    @staticmethod
    def get_current_commit() -> str:
        try:
            res = subprocess.run(
                ["git", "rev-parse", "--short", "HEAD"],
                capture_output=True,
                text=True,
                timeout=2
            )
            if res.returncode == 0:
                return res.stdout.strip()
        except Exception:
            pass
        return "1.0.0"

    @classmethod
    async def check_updates(cls) -> Dict[str, Any]:
        current = cls.get_current_commit()
        latest_commit = current
        commit_msg = "Up to date"
        has_update = False
        published_at = None

        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(
                    cls.REPO_API_URL,
                    headers={"User-Agent": "CorporateMailPlatform-Updater"}
                )
                if res.status_code == 200:
                    data = res.json()
                    latest_commit = data.get("sha", "")[:7]
                    commit_msg = data.get("commit", {}).get("message", "").split("\n")[0]
                    published_at = data.get("commit", {}).get("author", {}).get("date")
                    if latest_commit and current and latest_commit != current and current != "1.0.0":
                        has_update = True
        except Exception as e:
            commit_msg = f"Unable to check GitHub: {str(e)}"

        return {
            "current_version": current,
            "latest_version": latest_commit,
            "has_update": has_update,
            "commit_message": commit_msg,
            "published_at": published_at,
            "repo_url": "https://github.com/Cyber24BD/vps-mail-server"
        }

    @classmethod
    def apply_update(cls) -> Dict[str, Any]:
        """
        Launches update.sh in a detached process so it doesn't block the API.
        """
        try:
            subprocess.Popen(["bash", "update.sh"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return {"success": True, "message": "Update process initiated in background. Microservices will rebuild."}
        except Exception as e:
            return {"success": False, "error": str(e)}
