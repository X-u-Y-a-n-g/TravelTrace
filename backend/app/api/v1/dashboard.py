"""Dashboard statistics and instance settings endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.import_task import InstanceSettingsOut
from app.schemas.map import StatsOverview
from app.services import settings_service, stats_service

router = APIRouter(tags=["dashboard"])


@router.get("/stats/overview", response_model=StatsOverview, summary="Dashboard overview")
def overview(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> StatsOverview:
    return stats_service.overview(db, user.id)


@router.get("/settings", response_model=InstanceSettingsOut, summary="Instance settings")
def settings(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> InstanceSettingsOut:
    return settings_service.instance_settings(db, user.id)
