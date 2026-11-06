"""Photo queries."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import NotFoundError
from app.models import Photo, Trip


class PhotoRepository:
    @staticmethod
    def visible_query(user_id: UUID) -> Select:
        """Photos owned by the user, excluding deleted photos and deleted trips."""
        return (
            select(Photo)
            .outerjoin(Trip, Photo.trip_id == Trip.id)
            .where(
                Photo.user_id == user_id,
                Photo.deleted_at.is_(None),
                or_(Photo.trip_id.is_(None), Trip.deleted_at.is_(None)),
            )
        )

    @staticmethod
    def get(db: Session, photo_id: UUID, user_id: UUID) -> Photo:
        photo = db.scalar(
            select(Photo)
            .options(selectinload(Photo.place))
            .where(
                Photo.id == photo_id,
                Photo.user_id == user_id,
                Photo.deleted_at.is_(None),
            )
        )
        if photo is None:
            raise NotFoundError("Photo not found")
        return photo

    @staticmethod
    def apply_filters(
        stmt: Select,
        *,
        trip_id: UUID | None = None,
        place_id: UUID | None = None,
        unsorted: bool = False,
        has_gps: bool | None = None,
        is_favorite: bool | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        query: str | None = None,
        camera: str | None = None,
    ) -> Select:
        if trip_id is not None:
            stmt = stmt.where(Photo.trip_id == trip_id)
        if unsorted:
            stmt = stmt.where(Photo.trip_id.is_(None))
        if place_id is not None:
            stmt = stmt.where(Photo.place_id == place_id)
        if has_gps is True:
            stmt = stmt.where(Photo.latitude.is_not(None), Photo.longitude.is_not(None))
        elif has_gps is False:
            stmt = stmt.where(or_(Photo.latitude.is_(None), Photo.longitude.is_(None)))
        if is_favorite is not None:
            stmt = stmt.where(Photo.is_favorite.is_(is_favorite))
        if date_from is not None:
            stmt = stmt.where(Photo.taken_at >= datetime.combine(date_from, datetime.min.time()))
        if date_to is not None:
            stmt = stmt.where(Photo.taken_at < datetime.combine(date_to, datetime.max.time()))
        if query:
            needle = f"%{query.lower()}%"
            stmt = stmt.where(
                or_(
                    # SQLite and PostgreSQL both understand lower()/LIKE.
                    Photo.original_filename.ilike(needle),
                    Photo.caption.ilike(needle),
                    Photo.camera_model.ilike(needle),
                )
            )
        if camera:
            stmt = stmt.where(Photo.camera_model.ilike(f"%{camera}%"))
        return stmt
