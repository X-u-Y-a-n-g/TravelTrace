"""Map aggregation: markers and route geometries."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Photo, Place, Trip, TripPlace
from app.schemas.map import MapMarker, MapMarkersOut

MAX_PLACES = 500


def _photo_conditions(
    *,
    user_id: UUID,
    trip_ids: list[UUID] | None,
    bbox: tuple[float, float, float, float] | None,
    date_from: date | None,
    date_to: date | None,
    categories: list[str] | None,
) -> list:
    conditions = [
        Photo.user_id == user_id,
        Photo.deleted_at.is_(None),
        Trip.deleted_at.is_(None),
        Photo.latitude.is_not(None),
        Photo.longitude.is_not(None),
    ]
    if trip_ids:
        conditions.append(Photo.trip_id.in_(trip_ids))
    if bbox is not None:
        min_lon, min_lat, max_lon, max_lat = bbox
        conditions.append(Photo.longitude.between(min_lon, max_lon))
        conditions.append(Photo.latitude.between(min_lat, max_lat))
    if date_from is not None:
        conditions.append(Photo.taken_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to is not None:
        conditions.append(Photo.taken_at <= datetime.combine(date_to, datetime.max.time()))
    if categories:
        conditions.append(Photo.place_id.is_not(None))
        conditions.append(Place.category.in_(categories))
    return conditions


def _place_conditions(
    *,
    user_id: UUID,
    trip_ids: list[UUID] | None,
    bbox: tuple[float, float, float, float] | None,
    categories: list[str] | None,
) -> list:
    conditions = [
        Place.user_id == user_id,
        Place.latitude.is_not(None),
        Place.longitude.is_not(None),
    ]
    # The map shows places that are part of a visible trip, not every saved POI.
    visited_places = (
        select(TripPlace.place_id)
        .join(Trip, Trip.id == TripPlace.trip_id)
        .where(Trip.user_id == user_id, Trip.deleted_at.is_(None))
    )
    if trip_ids:
        visited_places = visited_places.where(TripPlace.trip_id.in_(trip_ids))
    conditions.append(Place.id.in_(visited_places))
    if bbox is not None:
        min_lon, min_lat, max_lon, max_lat = bbox
        conditions.append(Place.longitude.between(min_lon, max_lon))
        conditions.append(Place.latitude.between(min_lat, max_lat))
    if categories:
        conditions.append(Place.category.in_(categories))
    return conditions


def get_markers(
    db: Session,
    user_id: UUID,
    *,
    trip_ids: list[UUID] | None = None,
    bbox: tuple[float, float, float, float] | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    categories: list[str] | None = None,
    limit: int = 2000,
) -> MapMarkersOut:
    photo_conditions = _photo_conditions(
        user_id=user_id,
        trip_ids=trip_ids,
        bbox=bbox,
        date_from=date_from,
        date_to=date_to,
        categories=categories,
    )
    photo_total = int(
        db.scalar(
            select(func.count(Photo.id))
            .join(Trip, Trip.id == Photo.trip_id)
            .outerjoin(Place, Place.id == Photo.place_id)
            .where(*photo_conditions)
        )
        or 0
    )
    photo_rows = db.execute(
        select(Photo, Place.name, Place.category, Trip.title)
        .join(Trip, Trip.id == Photo.trip_id)
        .outerjoin(Place, Place.id == Photo.place_id)
        .where(*photo_conditions)
        .order_by(Photo.taken_at.is_(None), Photo.taken_at.desc(), Photo.created_at.desc())
        .limit(limit)
    ).all()

    place_conditions = _place_conditions(
        user_id=user_id, trip_ids=trip_ids, bbox=bbox, categories=categories
    )
    place_total = int(db.scalar(select(func.count(Place.id)).where(*place_conditions)) or 0)
    places = db.scalars(
        select(Place).where(*place_conditions).order_by(Place.name).limit(MAX_PLACES)
    ).all()

    photo_markers = [
        MapMarker(
            id=photo.id,
            kind="photo",
            latitude=photo.latitude,  # type: ignore[arg-type]
            longitude=photo.longitude,  # type: ignore[arg-type]
            title=place_name or photo.caption or photo.original_filename,
            subtitle=" · ".join(
                part
                for part in (
                    trip_title,
                    photo.taken_at.strftime("%b %d, %Y · %H:%M") if photo.taken_at else None,
                )
                if part
            ),
            category=category,
            trip_id=photo.trip_id,
            trip_title=trip_title,
            place_id=photo.place_id,
            photo_id=photo.id,
            taken_at=photo.taken_at,
        )
        for photo, place_name, category, trip_title in photo_rows
    ]

    place_markers = [
        MapMarker(
            id=place.id,
            kind="place",
            latitude=place.latitude,  # type: ignore[arg-type]
            longitude=place.longitude,  # type: ignore[arg-type]
            title=place.name,
            subtitle=", ".join(part for part in (place.city, place.country) if part) or None,
            category=place.category,
            place_id=place.id,
        )
        for place in places
    ]

    items = place_markers + photo_markers
    total = photo_total + place_total
    return MapMarkersOut(items=items, total=total, truncated=total > len(items))


def get_routes(db: Session, user_id: UUID, *, trip_id: UUID | None = None) -> dict:
    statement = select(Trip).where(Trip.user_id == user_id, Trip.deleted_at.is_(None))
    if trip_id is not None:
        statement = statement.where(Trip.id == trip_id)
    trips = db.scalars(statement.order_by(Trip.start_date.is_(None), Trip.start_date)).all()

    features = []
    for trip in trips:
        visits = db.scalars(
            select(Place)
            .join(TripPlace, TripPlace.place_id == Place.id)
            .where(
                TripPlace.trip_id == trip.id,
                Place.latitude.is_not(None),
                Place.longitude.is_not(None),
            )
            .order_by(
                TripPlace.sort_order,
                TripPlace.arrival_time.is_(None),
                TripPlace.arrival_time,
            )
        ).all()
        coordinates = [[place.longitude, place.latitude] for place in visits]
        kind = "places"

        if len(coordinates) < 2:
            photos = db.scalars(
                select(Photo)
                .where(
                    Photo.trip_id == trip.id,
                    Photo.deleted_at.is_(None),
                    Photo.latitude.is_not(None),
                    Photo.longitude.is_not(None),
                )
                .order_by(Photo.taken_at.is_(None), Photo.taken_at.asc())
                .limit(1000)
            ).all()
            coordinates = [[photo.longitude, photo.latitude] for photo in photos]
            kind = "photos"

        if len(coordinates) < 2:
            continue

        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": coordinates},
                "properties": {
                    "trip_id": str(trip.id),
                    "title": trip.title,
                    "kind": kind,
                    "stop_count": len(coordinates),
                },
            }
        )

    return {"type": "FeatureCollection", "features": features}
