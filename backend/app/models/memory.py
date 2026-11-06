"""Memory book model — generated travel recap (v0.3)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import MemoryStatus, enum_column
from app.models.types import json_type

if TYPE_CHECKING:  # pragma: no cover
    from app.models.trip import Trip


class MemoryBook(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "memory_books"

    trip_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    template: Mapped[str] = mapped_column(
        String(50), default="classic", server_default="classic", nullable=False
    )
    status: Mapped[MemoryStatus] = mapped_column(
        enum_column(MemoryStatus, 16),
        default=MemoryStatus.draft,
        server_default=MemoryStatus.draft.value,
        nullable=False,
    )
    content: Mapped[dict] = mapped_column(json_type(), default=dict, nullable=False)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    trip: Mapped[Trip] = relationship("Trip")
