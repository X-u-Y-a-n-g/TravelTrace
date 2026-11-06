"""Photo schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

from app.models.enums import GpsSource, PhotoStatus
from app.schemas.common import ORMModel
from app.schemas.place import PlaceSummary

Latitude = Annotated[float, Field(ge=-90, le=90)]
Longitude = Annotated[float, Field(ge=-180, le=180)]


class PhotoMini(ORMModel):
    id: uuid.UUID
    taken_at: datetime | None
    latitude: float | None
    longitude: float | None
    is_favorite: bool
    caption: str | None = None
    width: int | None = None
    height: int | None = None


class PhotoOut(ORMModel):
    id: uuid.UUID
    trip_id: uuid.UUID | None
    place_id: uuid.UUID | None
    place: PlaceSummary | None = None
    original_filename: str
    mime_type: str
    file_size: int
    width: int | None
    height: int | None
    taken_at: datetime | None
    taken_at_offset_minutes: int | None
    latitude: float | None
    longitude: float | None
    has_gps: bool = False
    gps_source: GpsSource
    camera_make: str | None
    camera_model: str | None
    lens: str | None
    caption: str | None
    is_favorite: bool
    status: PhotoStatus
    created_at: datetime


class PhotoUpdate(BaseModel):
    """Partial update. ``null`` explicitly clears a nullable field."""

    trip_id: uuid.UUID | None = None
    place_id: uuid.UUID | None = None
    caption: Annotated[str | None, Field(max_length=2000)] = None
    taken_at: datetime | None = None
    latitude: Latitude | None = None
    longitude: Longitude | None = None
    is_favorite: bool | None = None


class PhotoBulkUpdate(BaseModel):
    photo_ids: Annotated[list[uuid.UUID], Field(min_length=1, max_length=500)]
    trip_id: uuid.UUID | None = None
    place_id: uuid.UUID | None = None
    is_favorite: bool | None = None


class PhotoUploadResult(BaseModel):
    task_id: uuid.UUID
    uploaded_files: int
