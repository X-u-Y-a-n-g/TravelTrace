"""Place queries."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.models import Place, TripPlace


class PlaceRepository:
    @staticmethod
    def visible_query(user_id: UUID) -> Select:
        return select(Place).where(Place.user_id == user_id)

    @staticmethod
    def get(db: Session, place_id: UUID, user_id: UUID) -> Place:
        place = db.scalar(select(Place).where(Place.id == place_id, Place.user_id == user_id))
        if place is None:
            raise NotFoundError("Place not found")
        return place

    @staticmethod
    def apply_filters(
        stmt: Select,
        *,
        trip_id: UUID | None = None,
        category: str | None = None,
        query: str | None = None,
        bbox: tuple[float, float, float, float] | None = None,
    ) -> Select:
        if trip_id is not None:
            stmt = stmt.join(TripPlace, TripPlace.place_id == Place.id).where(
                TripPlace.trip_id == trip_id
            )
        if category:
            stmt = stmt.where(Place.category == category)
        if query:
            needle = f"%{query.lower()}%"
            stmt = stmt.where(
                or_(
                    Place.name.ilike(needle),
                    Place.city.ilike(needle),
                    Place.country.ilike(needle),
                    Place.address.ilike(needle),
                )
            )
        if bbox is not None:
            min_lon, min_lat, max_lon, max_lat = bbox
            stmt = stmt.where(
                Place.longitude.between(min_lon, max_lon),
                Place.latitude.between(min_lat, max_lat),
            )
        return stmt

    @staticmethod
    def trip_ids_for_places(db: Session, place_ids: list[UUID]) -> dict[UUID, list[UUID]]:
        if not place_ids:
            return {}
        rows = db.execute(
            select(TripPlace.place_id, TripPlace.trip_id).where(TripPlace.place_id.in_(place_ids))
        ).all()
        mapping: dict[UUID, list[UUID]] = {}
        for place_id, trip_id in rows:
            mapping.setdefault(place_id, []).append(trip_id)
        return mapping
