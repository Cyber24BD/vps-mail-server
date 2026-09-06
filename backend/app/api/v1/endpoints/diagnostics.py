from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.system import SystemHealthOverview, SystemResourceMetrics, ServiceHealth
from app.services.diagnostics_service import DiagnosticsService
from app.api.deps import get_current_admin

router = APIRouter()


@router.get("/health", response_model=SystemHealthOverview)
async def get_system_health(
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    services_data = await DiagnosticsService.check_all_services(db)
    overall = "healthy"
    for s in services_data:
        if s["status"] == "critical":
            overall = "critical"
            break
        elif s["status"] in ("warning", "offline") and overall != "critical":
            overall = "warning"

    return SystemHealthOverview(
        overall_status=overall,
        timestamp=datetime.now(timezone.utc),
        services=[ServiceHealth(**s) for s in services_data]
    )


@router.get("/metrics", response_model=SystemResourceMetrics)
async def get_system_metrics(
    admin = Depends(get_current_admin)
):
    data = DiagnosticsService.get_system_resources()
    return SystemResourceMetrics(**data)
