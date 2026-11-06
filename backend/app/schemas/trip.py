"""Trip schemas."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.enums import Visibility
from app.schemas.common import ORMModel
from app.schemas.photo import PhotoMini
from app.schemas.place import TripPlaceOut

Title = Annotated[str, Field(min_length=1, max_length=160)]


class TripCreate(BaseModel):
    title: Title
    description: Annotated[str | None, Field(max_length=20_000)] = None
    start_date: date | None = None
    end_date: date | None = None
    visibility: Visibility = Visibility.private

    @field_validator("title", "description")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def _title_not_blank(self) -> TripCreate:
        if not self.title.strip():
            raise ValueError("title must not be blank")
        return self

    @model_validator(mode="after")
    def _dates_order(self) -> TripCreate:
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class TripUpdate(BaseModel):
    title: Title | None = None
    description: Annotated[str | None, Field(max_length=20_000)] = None
    start_date: date | None = None
    end_date: date | None = None
    visibility: Visibility | None = None
    cover_photo_id: uuid.UUID | None = None

    @field_validator("title", "description")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def _title_not_blank(self) -> TripUpdate:
        if self.title is not None and not self.title.strip():
            raise ValueError("title must not be blank")
        return self


class TripStats(BaseModel):
    photo_count: int = 0
    place_count: int = 0
    day_count: int = 0
    photo_days: int = 0
    gps_photo_count: int = 0
    favorite_count: int = 0
    first_photo_at: datetime | None = None
    last_photo_at: datetime | None = None


class TripOut(ORMModel):
    id: uuid.UUID
    title: str
    description: str | None
    start_date: date | None
    end_date: date | None
    visibility: Visibility
    cover_photo_id: uuid.UUID | None
    cover_photo: PhotoMini | None = None
    day_count: int = 0
    photo_count: int = 0
    place_count: int = 0
    created_at: datetime
    updated_at: datetime


class TripDetailOut(TripOut):
    places: list[TripPlaceOut] = Field(default_factory=list)
    stats: TripStats = Field(default_factory=TripStats)
    photos_preview: list[PhotoMini] = Field(default_factory=list)


class TripExportRequest(BaseModel):
    include_originals: bool = True
