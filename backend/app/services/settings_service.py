"""Instance settings / storage summary."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Photo, Trip
from app.schemas.import_task import InstanceSettingsOut
from app.services.photo_service import storage_usage


def instance_settings(db: Session, user_id: UUID) -> InstanceSettingsOut:
    photo_count = int(
        db.scalar(
            select(func.count(Photo.id)).where(Photo.user_id == user_id, Photo.deleted_at.is_(None))
        )
        or 0
    )
    trip_count = int(
        db.scalar(
            select(func.count(Trip.id)).where(Trip.user_id == user_id, Trip.deleted_at.is_(None))
        )
        or 0
    )
    return InstanceSettingsOut(
        app_name=settings.app_name,
        app_version=settings.app_version,
        environment=settings.environment,
        registration_enabled=settings.allow_registration,
        geocoding_enabled=settings.geocoding_provider != "none",
        geocoding_provider=settings.geocoding_provider,
        max_upload_mb=settings.max_upload_mb,
        max_upload_files=settings.max_upload_files,
        storage_used_bytes=storage_usage(db, user_id),
        photo_count=photo_count,
        trip_count=trip_count,
    )
