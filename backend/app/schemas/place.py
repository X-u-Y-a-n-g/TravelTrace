"""Place schemas."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.enums import PlaceCategory
from app.schemas.common import ORMModel

Latitude = Annotated[float, Field(ge=-90, le=90)]
Longitude = Annotated[float, Field(ge=-180, le=180)]


class PlaceBase(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=255)]
    category: PlaceCategory = PlaceCategory.other
    address: Annotated[str | None, Field(max_length=500)] = None
    city: Annotated[str | None, Field(max_length=120)] = None
    region: Annotated[str | None, Field(max_length=120)] = None
    country: Annotated[str | None, Field(max_length=120)] = None
    country_code: Annotated[str | None, Field(min_length=2, max_length=2)] = None
    latitude: Latitude | None = None
    longitude: Longitude | None = None
    notes: Annotated[str | None, Field(max_length=2000)] = None

    @field_validator("name", "city", "region", "country", "address", "notes")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        value = value.strip() if isinstance(value, str) else value
        return value

    @model_validator(mode="after")
    def _name_not_blank(self) -> PlaceBase:
        if not self.name.strip():
            raise ValueError("name must not be blank")
        return self

    @field_validator("country_code")
    @classmethod
    def _upper_country(cls, value: str | None) -> str | None:
        return value.upper() if value else value

    @model_validator(mode="after")
    def _coordinates_together(self) -> PlaceBase:
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be provided together")
        return self


class PlaceCreate(PlaceBase):
    pass


class PlaceUpdate(BaseModel):
    name: Annotated[str | None, Field(min_length=1, max_length=255)] = None
    category: PlaceCategory | None = None
    address: Annotated[str | None, Field(max_length=500)] = None
    city: Annotated[str | None, Field(max_length=120)] = None
    region: Annotated[str | None, Field(max_length=120)] = None
    country: Annotated[str | None, Field(max_length=120)] = None
    country_code: Annotated[str | None, Field(min_length=2, max_length=2)] = None
    latitude: Latitude | None = None
    longitude: Longitude | None = None
    notes: Annotated[str | None, Field(max_length=2000)] = None

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("name must not be blank")
        return value

    @field_validator("country_code")
    @classmethod
    def _upper_country(cls, value: str | None) -> str | None:
        return value.upper() if value else value


class PlaceOut(ORMModel):
    id: uuid.UUID
    name: str
    category: PlaceCategory
    address: str | None
    city: str | None
    region: str | None
    country: str | None
    country_code: str | None
    latitude: float | None
    longitude: float | None
    notes: str | None
    source: str
    photo_count: int = 0
    visit_count: int = 0
    created_at: datetime


class PlaceSummary(ORMModel):
    id: uuid.UUID
    name: str
    category: PlaceCategory
    city: str | None = None
    country: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class TripPlaceCreate(BaseModel):
    place_id: uuid.UUID
    arrival_time: datetime | None = None
    departure_time: datetime | None = None
    day: date | None = None
    sort_order: int | None = None
    notes: Annotated[str | None, Field(max_length=2000)] = None


class TripPlaceUpdate(BaseModel):
    arrival_time: datetime | None = None
    departure_time: datetime | None = None
    sort_order: int | None = None
    notes: Annotated[str | None, Field(max_length=2000)] = None


class TripPlaceOut(ORMModel):
    id: uuid.UUID
    place: PlaceSummary
    arrival_time: datetime | None
    departure_time: datetime | None
    day: date | None
    sort_order: int
    notes: str | None


class GeocodeRequest(BaseModel):
    latitude: Latitude
    longitude: Longitude


class GeocodeResult(BaseModel):
    provider: str
    display_name: str | None = None
    name: str | None = None
    address: str | None = None
    city: str | None = None
    region: str | None = None
    country: str | None = None
    country_code: str | None = None
    latitude: float | None = None
    longitude: float | None = None
