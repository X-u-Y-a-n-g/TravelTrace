"""Timeline schemas."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.enums import EventSource, EventStatus, EventType
from app.schemas.common import ORMModel
from app.schemas.photo import PhotoMini
from app.schemas.place import PlaceSummary


class EventCreate(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=200)]
    description: Annotated[str | None, Field(max_length=5000)] = None
    event_type: EventType = EventType.other
    start_time: datetime
    end_time: datetime | None = None
    place_id: uuid.UUID | None = None
    photo_ids: Annotated[list[uuid.UUID], Field(max_length=200)] = Field(default_factory=list)

    @field_validator("title")
    @classmethod
    def _title_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("title must not be blank")
        return value

    @model_validator(mode="after")
    def _end_after_start(self) -> EventCreate:
        if self.end_time and self.end_time < self.start_time:
            raise ValueError("end_time must be on or after start_time")
        return self


class EventUpdate(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=200)] | None = None
    description: Annotated[str | None, Field(max_length=5000)] = None
    event_type: EventType | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    place_id: uuid.UUID | None = None
    status: EventStatus | None = None
    photo_ids: Annotated[list[uuid.UUID], Field(max_length=200)] | None = None

    @field_validator("title")
    @classmethod
    def _title_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("title must not be blank")
        return value


class EventOut(ORMModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    title: str
    description: str | None
    event_type: EventType
    start_time: datetime
    end_time: datetime | None
    day: date
    sort_order: int
    source: EventSource
    status: EventStatus
    place: PlaceSummary | None = None
    photos: list[PhotoMini] = Field(default_factory=list)


class TimelineDay(BaseModel):
    date: date
    day_index: int
    events: list[EventOut]


class TimelineOut(BaseModel):
    trip_id: uuid.UUID
    start_date: date | None = None
    end_date: date | None = None
    days: list[TimelineDay]
    event_count: int
    photo_count: int


class GenerateTimelineRequest(BaseModel):
    max_gap_minutes: int = Field(default=180, ge=15, le=1440)
    max_distance_km: float = Field(default=3.0, ge=0.05, le=100)
    replace_auto: bool = True


class TimelineGenerateResult(BaseModel):
    created_events: int
    assigned_photos: int
    kept_manual_events: int
    timeline: TimelineOut


class EventPhotoAttach(BaseModel):
    photo_ids: Annotated[list[uuid.UUID], Field(min_length=1, max_length=200)]
