"""Enumerations shared by models, schemas and services.

Values are stored as lower-case strings to keep migrations portable between
PostgreSQL and SQLite (no native enum types are created).
"""

from __future__ import annotations

from enum import Enum

from sqlalchemy import Enum as SAEnum


def enum_column(enum_cls: type[Enum], length: int = 32) -> SAEnum:
    return SAEnum(
        enum_cls,
        native_enum=False,
        length=length,
        values_callable=lambda cls: [member.value for member in cls],
        validate_strings=True,
        name=enum_cls.__name__.lower(),
    )


class Visibility(str, Enum):
    private = "private"
    unlisted = "unlisted"
    public = "public"


class MemberRole(str, Enum):
    owner = "owner"
    editor = "editor"
    viewer = "viewer"


class PlaceCategory(str, Enum):
    attraction = "attraction"
    food = "food"
    lodging = "lodging"
    transport = "transport"
    nature = "nature"
    shopping = "shopping"
    other = "other"


class GpsSource(str, Enum):
    exif = "exif"
    manual = "manual"
    track = "track"
    inferred = "inferred"
    none = "none"


class PhotoStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    ready = "ready"
    failed = "failed"


class EventType(str, Enum):
    sightseeing = "sightseeing"
    food = "food"
    transport = "transport"
    lodging = "lodging"
    activity = "activity"
    other = "other"


class EventSource(str, Enum):
    manual = "manual"
    auto = "auto"


class EventStatus(str, Enum):
    draft = "draft"
    confirmed = "confirmed"


class TrackActivityType(str, Enum):
    walking = "walking"
    hiking = "hiking"
    cycling = "cycling"
    driving = "driving"
    train = "train"
    flight = "flight"
    boat = "boat"
    other = "other"


class ImportType(str, Enum):
    photo_import = "photo_import"
    track_import = "track_import"
    export = "export"


class ImportStatus(str, Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    partial = "partial"
    failed = "failed"
    cancelled = "cancelled"


class MemoryStatus(str, Enum):
    draft = "draft"
    ready = "ready"
    failed = "failed"
