"""Map and dashboard schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.models.enums import PlaceCategory
from app.schemas.photo import PhotoMini
from app.schemas.trip import TripOut


class MapMarker(BaseModel):
    id: uuid.UUID
    kind: Literal["photo", "place"]
    latitude: float
    longitude: float
    title: str
    subtitle: str | None = None
    category: PlaceCategory | None = None
    trip_id: uuid.UUID | None = None
    trip_title: str | None = None
    place_id: uuid.UUID | None = None
    photo_id: uuid.UUID | None = None
    taken_at: datetime | None = None


class MapMarkersOut(BaseModel):
    items: list[MapMarker]
    total: int
    truncated: bool


class MapRouteProperties(BaseModel):
    trip_id: uuid.UUID
    title: str
    kind: Literal["places", "photos"]
    stop_count: int


class YearStat(BaseModel):
    year: int
    trips: int
    photos: int


class CountryStat(BaseModel):
    country: str
    country_code: str | None = None
    place_count: int = 0
    photo_count: int = 0


class StatsOverview(BaseModel):
    trips: int
    countries: int
    cities: int
    places: int
    photos: int
    days: int
    favorite_photos: int
    gps_photos: int
    storage_bytes: int
    years: list[YearStat]
    countries_detail: list[CountryStat]
    recent_trips: list[TripOut]
    recent_photos: list[PhotoMini]
