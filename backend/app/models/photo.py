"""Photo model."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    false,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.geo import GeoPoint
from app.db.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import GpsSource, PhotoStatus, enum_column
from app.models.types import json_type

if TYPE_CHECKING:  # pragma: no cover
    from app.models.place import Place
    from app.models.timeline import EventMedia
    from app.models.trip import Trip


class Photo(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "photos"
    __table_args__ = (
        UniqueConstraint("user_id", "content_hash", name="content_hash"),
        Index("ix_photos_user_taken", "user_id", "taken_at"),
        Index("ix_photos_trip_taken", "trip_id", "taken_at"),
        Index("ix_photos_lat_lon", "latitude", "longitude"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    trip_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("trips.id", ondelete="SET NULL"), index=True
    )
    place_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("places.id", ondelete="SET NULL"), index=True
    )

    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    preview_path: Mapped[str | None] = mapped_column(String(500))
    thumb_path: Mapped[str | None] = mapped_column(String(500))
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(80), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)

    # EXIF timestamps carry no timezone; we keep the local wall-clock time the
    # photographer experienced and the UTC offset when the camera recorded one.
    taken_at: Mapped[datetime | None] = mapped_column(DateTime)
    taken_at_offset_minutes: Mapped[int | None] = mapped_column(Integer)

    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    location: Mapped[object | None] = mapped_column(GeoPoint)
    gps_source: Mapped[GpsSource] = mapped_column(
        enum_column(GpsSource, 16),
        default=GpsSource.none,
        server_default=GpsSource.none.value,
        nullable=False,
    )

    camera_make: Mapped[str | None] = mapped_column(String(120))
    camera_model: Mapped[str | None] = mapped_column(String(120))
    lens: Mapped[str | None] = mapped_column(String(120))
    orientation: Mapped[int | None] = mapped_column(Integer)

    caption: Mapped[str | None] = mapped_column(Text)
    is_favorite: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), nullable=False
    )
    status: Mapped[PhotoStatus] = mapped_column(
        enum_column(PhotoStatus, 16),
        default=PhotoStatus.pending,
        server_default=PhotoStatus.pending.value,
        nullable=False,
    )
    error_message: Mapped[str | None] = mapped_column(Text)
    photo_metadata: Mapped[dict] = mapped_column(
        "metadata", json_type(), default=dict, nullable=False
    )

    trip: Mapped[Trip | None] = relationship("Trip", back_populates="photos")
    place: Mapped[Place | None] = relationship("Place", back_populates="photos")
    event_media: Mapped[list[EventMedia]] = relationship(
        "EventMedia", back_populates="photo", cascade="all, delete-orphan", passive_deletes=True
    )

    @property
    def has_gps(self) -> bool:
        return self.latitude is not None and self.longitude is not None

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<Photo {self.original_filename!r}>"
