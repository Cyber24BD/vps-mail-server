import socket
from datetime import datetime, timezone
import psutil
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import settings
from app.repositories.admin_repo import AdminRepository
from app.repositories.domain_repo import DomainRepository
from app.repositories.mailbox_repo import MailboxRepository
from app.schemas.auth import AdminCreate, AdminOut, BootstrapStatus
from app.api.deps import log_action

router = APIRouter()


@router.get("/status", response_model=BootstrapStatus)
async def get_bootstrap_status(db: AsyncSession = Depends(get_db)):
    admin_repo = AdminRepository(db)
    domain_repo = DomainRepository(db)
    mailbox_repo = MailboxRepository(db)

    admin_count = await admin_repo.count()
    domain_count = await domain_repo.count()
    mailbox_count = await mailbox_repo.count()

    hostname = socket.gethostname()

    return BootstrapStatus(
        is_bootstrapped=(admin_count > 0),
        public_ip=settings.SERVER_IP,
        server_time=datetime.now(timezone.utc),
        hostname=hostname,
        total_domains=domain_count,
        total_mailboxes=mailbox_count
    )


@router.get("/system-specs")
async def get_system_specs():
    """
    Returns server specifications for Step 1 of the Setup Wizard.
    """
    cpu_count = psutil.cpu_count(logical=True)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    hostname = socket.gethostname()

    return {
        "hostname": hostname,
        "public_ip": settings.SERVER_IP,
        "cpu_cores": cpu_count,
        "ram_total_mb": round(mem.total / (1024 * 1024), 0),
        "disk_total_gb": round(disk.total / (1024 * 1024 * 1024), 1),
        "server_time": datetime.now(timezone.utc).isoformat(),
        "primary_ports": {
            "smtp": 25,
            "submission": 587,
            "imap": 143,
            "imaps": 993,
            "web_control": settings.CONTROL_PORT
        }
    }


@router.post("/setup", response_model=AdminOut)
async def bootstrap_initial_admin(
    admin_in: AdminCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Creates the first Super Administrator during Setup Wizard.
    Can only be executed when the system is not yet bootstrapped.
    """
    admin_repo = AdminRepository(db)
    count = await admin_repo.count()
    if count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System is already bootstrapped with an administrator account."
        )

    admin = await admin_repo.create(
        username=admin_in.username,
        email=admin_in.email,
        password=admin_in.password,
        role="super_admin"
    )
    await log_action(
        db,
        actor=admin.username,
        action="INITIAL_BOOTSTRAP",
        resource_type="administrator",
        resource_id=str(admin.id),
        details={"email": admin.email}
    )
    await db.commit()
    return admin
