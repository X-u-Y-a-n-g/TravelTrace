"""Import task and instance settings schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import ImportStatus, ImportType
from app.schemas.common import ORMModel


class ImportTaskOut(ORMModel):
    id: uuid.UUID
    trip_id: uuid.UUID | None
    task_type: ImportType
    status: ImportStatus
    progress: int
    total: int
    processed: int
    failed: int
    message: str | None
    error: str | None
    result: dict
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class ImportTaskSummary(BaseModel):
    task_id: uuid.UUID
    status: ImportStatus
    progress: int
    total: int
    processed: int
    failed: int
    message: str | None = None


class InstanceSettingsOut(BaseModel):
    app_name: str
    app_version: str
    environment: str
    registration_enabled: bool
    geocoding_enabled: bool
    geocoding_provider: str
    max_upload_mb: int
    max_upload_files: int
    storage_used_bytes: int
    photo_count: int
    trip_count: int
    map_style_url: str | None = None
