"""Trip ↔ place visit association."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:  # pragma: no cover
    from app.models.place import Place
    from app.models.trip import Trip


class TripPlace(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "trip_places"

    trip_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    place_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("places.id", ondelete="CASCADE"), nullable=False, index=True
    )
    arrival_time: Mapped[datetime | None] = mapped_column(DateTime)
    departure_time: Mapped[datetime | None] = mapped_column(DateTime)
    day: Mapped[date | None] = mapped_column(Date)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    trip: Mapped[Trip] = relationship("Trip", back_populates="trip_places")
    place: Mapped[Place] = relationship("Place", back_populates="trip_places")
