"""Timeline events and event/photo links."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import EventSource, EventStatus, EventType, enum_column

if TYPE_CHECKING:  # pragma: no cover
    from app.models.photo import Photo
    from app.models.place import Place
    from app.models.trip import Trip


class TimelineEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "timeline_events"
    __table_args__ = (Index("ix_timeline_events_trip_day", "trip_id", "day", "start_time"),)

    trip_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    place_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("places.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    event_type: Mapped[EventType] = mapped_column(
        enum_column(EventType, 24),
        default=EventType.other,
        server_default=EventType.other.value,
        nullable=False,
    )
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime | None] = mapped_column(DateTime)
    day: Mapped[date] = mapped_column(Date, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    source: Mapped[EventSource] = mapped_column(
        enum_column(EventSource, 16),
        default=EventSource.manual,
        server_default=EventSource.manual.value,
        nullable=False,
    )
    status: Mapped[EventStatus] = mapped_column(
        enum_column(EventStatus, 16),
        default=EventStatus.confirmed,
        server_default=EventStatus.confirmed.value,
        nullable=False,
    )

    trip: Mapped[Trip] = relationship("Trip", back_populates="events")
    place: Mapped[Place | None] = relationship("Place")
    media: Mapped[list[EventMedia]] = relationship(
        "EventMedia",
        back_populates="event",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="EventMedia.sort_order",
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<TimelineEvent {self.title!r}>"


class EventMedia(Base):
    __tablename__ = "event_media"

    event_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("timeline_events.id", ondelete="CASCADE"),
        primary_key=True,
    )
    photo_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("photos.id", ondelete="CASCADE"), primary_key=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)

    event: Mapped[TimelineEvent] = relationship("TimelineEvent", back_populates="media")
    photo: Mapped[Photo] = relationship("Photo", back_populates="event_media")
