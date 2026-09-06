import socket
import time
import psutil
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.config import settings


class DiagnosticsService:
    @staticmethod
    def check_socket(host: str, port: int, timeout: float = 2.0) -> Dict[str, Any]:
        start = time.perf_counter()
        try:
            with socket.create_connection((host, port), timeout=timeout):
                latency = round((time.perf_counter() - start) * 1000, 2)
                return {"status": "healthy", "latency_ms": latency, "details": f"Port {port} accessible"}
        except (socket.timeout, ConnectionRefusedError, OSError) as e:
            return {"status": "offline", "latency_ms": None, "details": str(e)}

    @classmethod
    async def check_all_services(cls, db: AsyncSession) -> List[Dict[str, Any]]:
        services = []

        # 1. FastAPI Backend
        services.append({
            "name": "API Service",
            "status": "healthy",
            "details": "FastAPI engine operating normally",
            "response_time_ms": 1.0
        })

        # 2. PostgreSQL Database
        db_start = time.perf_counter()
        try:
            await db.execute(text("SELECT 1"))
            db_lat = round((time.perf_counter() - db_start) * 1000, 2)
            services.append({
                "name": "PostgreSQL Database",
                "status": "healthy",
                "details": "Read/Write queries active",
                "response_time_ms": db_lat
            })
        except Exception as e:
            services.append({
                "name": "PostgreSQL Database",
                "status": "critical",
                "details": f"Database query failed: {str(e)}",
                "response_time_ms": None
            })

        # 3. Redis Cache & Queue
        redis_res = cls.check_socket(settings.REDIS_HOST, settings.REDIS_PORT)
        services.append({
            "name": "Redis Broker",
            "status": redis_res["status"],
            "details": redis_res["details"],
            "response_time_ms": redis_res["latency_ms"]
        })

        # 4. Postfix SMTP
        smtp_res = cls.check_socket("postfix", 25)
        services.append({
            "name": "Postfix SMTP",
            "status": smtp_res["status"],
            "details": smtp_res["details"],
            "response_time_ms": smtp_res["latency_ms"]
        })

        # 5. Dovecot IMAP
        imap_res = cls.check_socket("dovecot", 143)
        services.append({
            "name": "Dovecot IMAP",
            "status": imap_res["status"],
            "details": imap_res["details"],
            "response_time_ms": imap_res["latency_ms"]
        })

        # 6. Rspamd Antispam
        rspamd_res = cls.check_socket("rspamd", 11334)
        services.append({
            "name": "Rspamd Engine",
            "status": rspamd_res["status"],
            "details": rspamd_res["details"],
            "response_time_ms": rspamd_res["latency_ms"]
        })

        # 7. ClamAV Antivirus
        clam_res = cls.check_socket("clamav", 3310)
        services.append({
            "name": "ClamAV Scanner",
            "status": clam_res["status"],
            "details": clam_res["details"],
            "response_time_ms": clam_res["latency_ms"]
        })

        return services

    @staticmethod
    def get_system_resources() -> Dict[str, Any]:
        cpu = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")

        return {
            "cpu_percent": round(cpu, 1),
            "memory_total_mb": round(mem.total / (1024 * 1024), 1),
            "memory_used_mb": round(mem.used / (1024 * 1024), 1),
            "memory_percent": round(mem.percent, 1),
            "disk_total_gb": round(disk.total / (1024 * 1024 * 1024), 1),
            "disk_used_gb": round(disk.used / (1024 * 1024 * 1024), 1),
            "disk_percent": round(disk.percent, 1),
            "active_connections": len(psutil.net_connections()),
            "mail_queue_count": 0
        }
