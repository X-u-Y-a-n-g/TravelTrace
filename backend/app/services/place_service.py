"""Place business logic."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import BadRequestError, ConflictError, NotFoundError, UnprocessableError
from app.models import Photo, Place, Trip, TripPlace
from app.processors.geocoding import get_geocoding_provider
from app.repositories import PlaceRepository, TripRepository
from app.schemas.common import Page
from app.schemas.place import (
    GeocodeResult,
    PlaceCreate,
    PlaceOut,
    PlaceUpdate,
    TripPlaceCreate,
    TripPlaceOut,
    TripPlaceUpdate,
)
from app.services.serializers import place_summary


def _photo_counts(db: Session, place_ids: list[UUID]) -> dict[UUID, int]:
    if not place_ids:
        return {}
    rows = db.execute(
        select(Photo.place_id, func.count(Photo.id))
        .where(
            Photo.place_id.in_(place_ids),
            Photo.deleted_at.is_(None),
        )
        .group_by(Photo.place_id)
    ).all()
    return {place_id: count for place_id, count in rows}


def _visit_counts(db: Session, user_id: UUID, place_ids: list[UUID]) -> dict[UUID, int]:
    if not place_ids:
        return {}
    rows = db.execute(
        select(TripPlace.place_id, func.count(TripPlace.id))
        .join(Trip, Trip.id == TripPlace.trip_id)
        .where(
            TripPlace.place_id.in_(place_ids),
            Trip.user_id == user_id,
            Trip.deleted_at.is_(None),
        )
        .group_by(TripPlace.place_id)
    ).all()
    return {place_id: count for place_id, count in rows}


def _serialise(place: Place, photo_count: int = 0, visit_count: int = 0) -> PlaceOut:
    return PlaceOut(
        id=place.id,
        name=place.name,
        category=place.category,
        address=place.address,
        city=place.city,
        region=place.region,
        country=place.country,
        country_code=place.country_code,
        latitude=place.latitude,
        longitude=place.longitude,
        notes=place.notes,
        source=place.source,
        photo_count=photo_count,
        visit_count=visit_count,
        created_at=place.created_at,
    )


def list_places(
    db: Session,
    user_id: UUID,
    *,
    page: int,
    size: int,
    trip_id: UUID | None = None,
    category: str | None = None,
    query: str | None = None,
    bbox: tuple[float, float, float, float] | None = None,
) -> Page:  # noqa: ANN201
    stmt = PlaceRepository.apply_filters(
        PlaceRepository.visible_query(user_id),
        trip_id=trip_id,
        category=category,
        query=query,
        bbox=bbox,
    )
    total = int(db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
    places = db.scalars(
        stmt.order_by(func.lower(Place.name).asc(), Place.created_at.asc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    ids = [place.id for place in places]
    photo_counts = _photo_counts(db, ids)
    visit_counts = _visit_counts(db, user_id, ids)
    items = [
        _serialise(place, photo_counts.get(place.id, 0), visit_counts.get(place.id, 0))
        for place in places
    ]
    return Page.build(items, total, page, size)


def get_place(db: Session, place_id: UUID, user_id: UUID) -> PlaceOut:
    place = PlaceRepository.get(db, place_id, user_id)
    counts = _photo_counts(db, [place.id])
    visits = _visit_counts(db, user_id, [place.id])
    return _serialise(place, counts.get(place.id, 0), visits.get(place.id, 0))


def create_place(db: Session, user_id: UUID, payload: PlaceCreate) -> Place:
    place = Place(
        user_id=user_id,
        name=payload.name,
        category=payload.category,
        address=payload.address,
        city=payload.city,
        region=payload.region,
        country=payload.country,
        country_code=payload.country_code,
        latitude=payload.latitude,
        longitude=payload.longitude,
        notes=payload.notes,
        source="manual",
    )
    db.add(place)
    db.commit()
    db.refresh(place)
    return place


def update_place(db: Session, place: Place, payload: PlaceUpdate) -> Place:
    data = payload.model_dump(exclude_unset=True)
    for field in ("name", "category", "address", "city", "region", "notes"):
        if field in data:
            setattr(place, field, data[field])
    if "country_code" in data:
        place.country_code = data["country_code"].upper() if data["country_code"] else None
    if "country" in data:
        place.country = data["country"]

    latitude = data.get("latitude", place.latitude)
    longitude = data.get("longitude", place.longitude)
    if (latitude is None) != (longitude is None):
        raise UnprocessableError(
            "latitude and longitude must be provided together", code="invalid_coordinates"
        )
    if (
        latitude is not None
        and longitude is not None
        and not (-90 <= latitude <= 90 and -180 <= longitude <= 180)
    ):
        raise UnprocessableError("Coordinates are out of range", code="invalid_coordinates")
    if "latitude" in data or "longitude" in data:
        place.latitude = latitude
        place.longitude = longitude

    db.commit()
    db.refresh(place)
    return place


def delete_place(db: Session, place: Place) -> None:
    db.delete(place)
    db.commit()


def list_trip_places(db: Session, trip_id: UUID, user_id: UUID) -> list[TripPlaceOut]:
    TripRepository.get(db, trip_id, user_id)
    visits = db.scalars(
        select(TripPlace)
        .options(selectinload(TripPlace.place))
        .where(TripPlace.trip_id == trip_id)
        .order_by(TripPlace.sort_order, TripPlace.arrival_time, TripPlace.created_at)
    ).all()
    return [
        TripPlaceOut(
            id=visit.id,
            place=place_summary(visit.place),
            arrival_time=visit.arrival_time,
            departure_time=visit.departure_time,
            day=visit.day,
            sort_order=visit.sort_order,
            notes=visit.notes,
        )
        for visit in visits
    ]


def attach_place(db: Session, trip: Trip, payload: TripPlaceCreate) -> TripPlace:
    place = PlaceRepository.get(db, payload.place_id, trip.user_id)
    duplicate = db.scalar(
        select(TripPlace).where(TripPlace.trip_id == trip.id, TripPlace.place_id == place.id)
    )
    if duplicate is not None:
        raise ConflictError("This place is already part of the trip", code="place_already_attached")

    max_order = db.scalar(
        select(func.max(TripPlace.sort_order)).where(TripPlace.trip_id == trip.id)
    )
    visit = TripPlace(
        trip_id=trip.id,
        place_id=place.id,
        arrival_time=payload.arrival_time,
        departure_time=payload.departure_time,
        day=payload.day or (payload.arrival_time.date() if payload.arrival_time else None),
        sort_order=payload.sort_order if payload.sort_order is not None else (max_order or 0) + 1,
        notes=payload.notes,
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)
    return visit


def update_trip_place(db: Session, visit: TripPlace, payload: TripPlaceUpdate) -> TripPlace:
    data = payload.model_dump(exclude_unset=True)
    for field in ("arrival_time", "departure_time", "sort_order", "notes"):
        if field in data:
            setattr(visit, field, data[field])
    if visit.arrival_time and visit.departure_time and visit.departure_time < visit.arrival_time:
        raise UnprocessableError(
            "departure_time must be on or after arrival_time", code="invalid_visit_times"
        )
    if visit.arrival_time and "day" not in data:
        visit.day = visit.arrival_time.date()
    db.commit()
    db.refresh(visit)
    return visit


def get_visit(db: Session, trip: Trip, visit_id: UUID) -> TripPlace:
    visit = db.scalar(
        select(TripPlace).where(TripPlace.id == visit_id, TripPlace.trip_id == trip.id)
    )
    if visit is None:
        raise NotFoundError("Trip place not found")
    return visit


def detach_place(db: Session, visit: TripPlace) -> None:
    db.delete(visit)
    db.commit()


def reverse_geocode(latitude: float, longitude: float) -> GeocodeResult:
    return get_geocoding_provider().reverse(latitude, longitude)


def validate_coordinate_pair(latitude: float | None, longitude: float | None) -> None:
    if (latitude is None) != (longitude is None):
        raise BadRequestError(
            "latitude and longitude must be provided together", code="invalid_coordinates"
        )
    if latitude is not None and not (-90 <= latitude <= 90):
        raise BadRequestError("latitude must be between -90 and 90", code="invalid_coordinates")
    if longitude is not None and not (-180 <= longitude <= 180):
        raise BadRequestError("longitude must be between -180 and 180", code="invalid_coordinates")
