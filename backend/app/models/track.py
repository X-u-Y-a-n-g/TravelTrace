"""GPS track models — parsed by the import pipeline (v0.2), schema ready in v0.1."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.geo import GeoPoint
from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import TrackActivityType, enum_column

if TYPE_CHECKING:  # pragma: no cover
    pass


class Track(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tracks"

    trip_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    activity_type: Mapped[TrackActivityType] = mapped_column(
        enum_column(TrackActivityType, 24),
        default=TrackActivityType.other,
        server_default=TrackActivityType.other.value,
        nullable=False,
    )
    source_format: Mapped[str | None] = mapped_column(String(20))
    distance_m: Mapped[float | None] = mapped_column(Float)
    duration_s: Mapped[int | None] = mapped_column(Integer)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime)

    points: Mapped[list[TrackPoint]] = relationship(
        "TrackPoint",
        back_populates="track",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="TrackPoint.sequence",
    )


class TrackPoint(Base):
    __tablename__ = "track_points"
    __table_args__ = (Index("ix_track_points_track_sequence", "track_id", "sequence"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    track_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False
    )
    sequence: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    recorded_at: Mapped[datetime | None] = mapped_column(DateTime)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    location: Mapped[object | None] = mapped_column(GeoPoint)
    elevation_m: Mapped[float | None] = mapped_column(Float)
    speed_mps: Mapped[float | None] = mapped_column(Float)

    track: Mapped[Track] = relationship("Track", back_populates="points")
