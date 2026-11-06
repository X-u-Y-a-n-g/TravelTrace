"""Import every model so SQLAlchemy's registry is complete."""

from app.core.geo import register_location_sync
from app.db.base import Base
from app.models.enums import (
    EventSource,
    EventStatus,
    EventType,
    GpsSource,
    ImportStatus,
    ImportType,
    MemberRole,
    MemoryStatus,
    PhotoStatus,
    PlaceCategory,
    TrackActivityType,
    Visibility,
)
from app.models.import_task import ImportTask
from app.models.journal import Journal
from app.models.memory import MemoryBook
from app.models.photo import Photo
from app.models.place import Place
from app.models.timeline import EventMedia, TimelineEvent
from app.models.track import Track, TrackPoint
from app.models.trip import Trip, TripMember
from app.models.trip_place import TripPlace
from app.models.user import User

register_location_sync(Photo, Place, TrackPoint)

__all__ = [
    "Base",
    "EventMedia",
    "EventSource",
    "EventStatus",
    "EventType",
    "GpsSource",
    "ImportStatus",
    "ImportTask",
    "ImportType",
    "Journal",
    "MemberRole",
    "MemoryBook",
    "MemoryStatus",
    "Photo",
    "PhotoStatus",
    "Place",
    "PlaceCategory",
    "TimelineEvent",
    "Track",
    "TrackActivityType",
    "TrackPoint",
    "Trip",
    "TripMember",
    "TripPlace",
    "User",
    "Visibility",
]
