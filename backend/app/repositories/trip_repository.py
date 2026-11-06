"""Trip queries."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.models import Photo, Trip, TripPlace


class TripRepository:
    @staticmethod
    def visible_query(user_id: UUID) -> Select:
        return select(Trip).where(Trip.user_id == user_id, Trip.deleted_at.is_(None))

    @staticmethod
    def get(db: Session, trip_id: UUID, user_id: UUID) -> Trip:
        trip = db.scalar(
            select(Trip).where(
                Trip.id == trip_id, Trip.user_id == user_id, Trip.deleted_at.is_(None)
            )
        )
        if trip is None:
            raise NotFoundError("Trip not found")
        return trip

    @staticmethod
    def get_any(db: Session, trip_id: UUID, user_id: UUID) -> Trip | None:
        return db.scalar(select(Trip).where(Trip.id == trip_id, Trip.user_id == user_id))

    @staticmethod
    def photo_counts(db: Session, trip_ids: list[UUID]) -> dict[UUID, int]:
        if not trip_ids:
            return {}
        rows = db.execute(
            select(Photo.trip_id, func.count(Photo.id))
            .where(Photo.trip_id.in_(trip_ids), Photo.deleted_at.is_(None))
            .group_by(Photo.trip_id)
        ).all()
        return {trip_id: count for trip_id, count in rows if trip_id is not None}

    @staticmethod
    def place_counts(db: Session, trip_ids: list[UUID]) -> dict[UUID, int]:
        if not trip_ids:
            return {}
        rows = db.execute(
            select(TripPlace.trip_id, func.count(TripPlace.id))
            .where(TripPlace.trip_id.in_(trip_ids))
            .group_by(TripPlace.trip_id)
        ).all()
        return {trip_id: count for trip_id, count in rows}

    @staticmethod
    def covers(db: Session, cover_ids: list[UUID]) -> dict[UUID, Photo]:
        if not cover_ids:
            return {}
        rows = db.scalars(
            select(Photo).where(Photo.id.in_(cover_ids), Photo.deleted_at.is_(None))
        ).all()
        return {photo.id: photo for photo in rows}

    @staticmethod
    def find_overlapping(db: Session, user_id: UUID, day: date) -> Trip | None:
        """Best trip covering ``day`` (smallest range wins, newest as tiebreak)."""
        candidates = db.scalars(
            select(Trip)
            .where(
                Trip.user_id == user_id,
                Trip.deleted_at.is_(None),
                Trip.start_date.is_not(None),
                Trip.end_date.is_not(None),
                Trip.start_date <= day,
                Trip.end_date >= day,
            )
            .order_by(Trip.start_date.desc())
        ).all()
        if not candidates:
            return None
        return min(candidates, key=lambda trip: (trip.end_date - trip.start_date).days)
