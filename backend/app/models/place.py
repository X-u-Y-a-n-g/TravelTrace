"""Reusable place model (a location, not a visit)."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.geo import GeoPoint
from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import PlaceCategory, enum_column

if TYPE_CHECKING:  # pragma: no cover
    from app.models.photo import Photo
    from app.models.trip_place import TripPlace


class Place(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "places"
    __table_args__ = (
        Index("ix_places_user_name", "user_id", "name"),
        Index("ix_places_lat_lon", "latitude", "longitude"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[PlaceCategory] = mapped_column(
        enum_column(PlaceCategory, 24),
        default=PlaceCategory.other,
        server_default=PlaceCategory.other.value,
        nullable=False,
    )
    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(120))
    region: Mapped[str | None] = mapped_column(String(120))
    country: Mapped[str | None] = mapped_column(String(120))
    country_code: Mapped[str | None] = mapped_column(String(2))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    location: Mapped[object | None] = mapped_column(GeoPoint)
    notes: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(
        String(20), default="manual", server_default="manual", nullable=False
    )
    external_id: Mapped[str | None] = mapped_column(String(120))

    trip_places: Mapped[list[TripPlace]] = relationship(
        "TripPlace", back_populates="place", cascade="all, delete-orphan", passive_deletes=True
    )
    photos: Mapped[list[Photo]] = relationship("Photo", back_populates="place")

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<Place {self.name!r}>"
