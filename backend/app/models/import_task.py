"""Asynchronous import job tracking."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ImportStatus, ImportType, enum_column
from app.models.types import json_type

if TYPE_CHECKING:  # pragma: no cover
    from app.models.trip import Trip
    from app.models.user import User


class ImportTask(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "import_tasks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    trip_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("trips.id", ondelete="SET NULL"), index=True
    )
    task_type: Mapped[ImportType] = mapped_column(
        enum_column(ImportType, 24),
        default=ImportType.photo_import,
        server_default=ImportType.photo_import.value,
        nullable=False,
    )
    status: Mapped[ImportStatus] = mapped_column(
        enum_column(ImportStatus, 16),
        default=ImportStatus.queued,
        server_default=ImportStatus.queued.value,
        nullable=False,
    )
    progress: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    total: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    processed: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    failed: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    message: Mapped[str | None] = mapped_column(String(500))
    error: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(json_type(), default=dict, nullable=False)
    result: Mapped[dict] = mapped_column(json_type(), default=dict, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    trip: Mapped[Trip | None] = relationship("Trip")
    user: Mapped[User] = relationship("User")
