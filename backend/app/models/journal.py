"""Travel journal model — writing experience lands in v0.3."""

from __future__ import annotations

import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:  # pragma: no cover
    from app.models.trip import Trip


class Journal(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "journals"

    trip_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str | None] = mapped_column(String(200))
    content_md: Mapped[str] = mapped_column(Text, default="", nullable=False)
    entry_date: Mapped[date | None] = mapped_column(Date)
    place_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("places.id", ondelete="SET NULL")
    )

    trip: Mapped[Trip] = relationship("Trip")
