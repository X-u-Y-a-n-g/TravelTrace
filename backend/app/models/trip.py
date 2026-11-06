"""Trip and trip member models."""

from __future__ import annotations

import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import MemberRole, Visibility, enum_column

if TYPE_CHECKING:  # pragma: no cover
    from app.models.photo import Photo
    from app.models.timeline import TimelineEvent
    from app.models.trip_place import TripPlace
    from app.models.user import User


class Trip(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "trips"
    __table_args__ = (
        Index("ix_trips_user_start", "user_id", "start_date"),
        CheckConstraint(
            "end_date IS NULL OR start_date IS NULL OR end_date >= start_date",
            name="dates_order",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    visibility: Mapped[Visibility] = mapped_column(
        enum_column(Visibility, 16),
        default=Visibility.private,
        server_default=Visibility.private.value,
        nullable=False,
    )
    # Intentionally not a foreign key: trips and photos reference each other and a
    # database-level cycle complicates table creation. Validated in the service.
    cover_photo_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))

    owner: Mapped[User] = relationship("User", back_populates="trips")
    photos: Mapped[list[Photo]] = relationship("Photo", back_populates="trip")
    trip_places: Mapped[list[TripPlace]] = relationship(
        "TripPlace",
        back_populates="trip",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="TripPlace.sort_order",
    )
    events: Mapped[list[TimelineEvent]] = relationship(
        "TimelineEvent",
        back_populates="trip",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="TimelineEvent.start_time",
    )
    members: Mapped[list[TripMember]] = relationship(
        "TripMember",
        back_populates="trip",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def day_count(self) -> int:
        if not self.start_date or not self.end_date:
            return 0
        return max((self.end_date - self.start_date).days + 1, 1)

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<Trip {self.title!r}>"


class TripMember(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "trip_members"
    __table_args__ = (UniqueConstraint("trip_id", "user_id", name="uq_trip_members_trip_user"),)

    trip_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[MemberRole] = mapped_column(
        enum_column(MemberRole, 16),
        default=MemberRole.owner,
        server_default=MemberRole.owner.value,
        nullable=False,
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)

    trip: Mapped[Trip] = relationship("Trip", back_populates="members")
