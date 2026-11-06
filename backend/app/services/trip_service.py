"""Trip business logic."""

from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import BadRequestError, NotFoundError, UnprocessableError
from app.models import Photo, Trip, TripMember, TripPlace
from app.models.enums import MemberRole
from app.repositories import TripRepository
from app.schemas.common import Page
from app.schemas.place import TripPlaceOut
from app.schemas.trip import TripCreate, TripDetailOut, TripOut, TripStats, TripUpdate
from app.services.serializers import photo_mini, place_summary, trip_out

SORT_OPTIONS = {
    "start_date_desc": (Trip.start_date.is_(None), Trip.start_date.desc(), Trip.created_at.desc()),
    "start_date_asc": (Trip.start_date.is_(None), Trip.start_date.asc(), Trip.created_at.desc()),
    "created_desc": (Trip.created_at.desc(),),
    "created_asc": (Trip.created_at.asc(),),
    "title_asc": (func.lower(Trip.title).asc(),),
}


def _apply_list_filters(
    stmt,  # noqa: ANN001
    *,
    query: str | None,
    year: int | None,
    visibility: str | None,
):  # noqa: ANN202
    if query:
        needle = f"%{query.lower()}%"
        stmt = stmt.where(or_(Trip.title.ilike(needle), Trip.description.ilike(needle)))
    if year is not None:
        start = date(year, 1, 1)
        end = date(year, 12, 31)
        stmt = stmt.where(
            Trip.start_date.is_not(None),
            Trip.end_date.is_not(None),
            and_(Trip.start_date <= end, Trip.end_date >= start),
        )
    if visibility:
        stmt = stmt.where(Trip.visibility == visibility)
    return stmt


def list_trips(
    db: Session,
    user_id: UUID,
    *,
    page: int,
    size: int,
    query: str | None = None,
    year: int | None = None,
    visibility: str | None = None,
    sort: str = "start_date_desc",
) -> Page:  # noqa: ANN201
    stmt = _apply_list_filters(
        TripRepository.visible_query(user_id), query=query, year=year, visibility=visibility
    )
    total = int(db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
    ordering = SORT_OPTIONS.get(sort, SORT_OPTIONS["start_date_desc"])
    trips = db.scalars(stmt.order_by(*ordering).offset((page - 1) * size).limit(size)).all()

    ids = [trip.id for trip in trips]
    photo_counts = TripRepository.photo_counts(db, ids)
    place_counts = TripRepository.place_counts(db, ids)
    cover_ids = [trip.cover_photo_id for trip in trips if trip.cover_photo_id]
    covers = TripRepository.covers(db, cover_ids)

    items = [
        trip_out(
            trip,
            photo_count=photo_counts.get(trip.id, 0),
            place_count=place_counts.get(trip.id, 0),
            cover_photo=covers.get(trip.cover_photo_id) if trip.cover_photo_id else None,
        )
        for trip in trips
    ]
    return Page.build(items, total, page, size)


def get_trip(db: Session, trip_id: UUID, user_id: UUID) -> Trip:
    return TripRepository.get(db, trip_id, user_id)


def trip_summary(db: Session, trip_id: UUID, user_id: UUID) -> TripOut:
    trip = get_trip(db, trip_id, user_id)
    photo_counts = TripRepository.photo_counts(db, [trip.id])
    place_counts = TripRepository.place_counts(db, [trip.id])
    cover = TripRepository.covers(db, [trip.cover_photo_id] if trip.cover_photo_id else []).get(
        trip.cover_photo_id
    )
    return trip_out(
        trip,
        photo_count=photo_counts.get(trip.id, 0),
        place_count=place_counts.get(trip.id, 0),
        cover_photo=cover,
    )


def _visits(db: Session, trip_id: UUID) -> list[TripPlace]:
    return list(
        db.scalars(
            select(TripPlace)
            .options(selectinload(TripPlace.place))
            .where(TripPlace.trip_id == trip_id)
            .order_by(TripPlace.sort_order, TripPlace.arrival_time, TripPlace.created_at)
        ).all()
    )


def _count(db: Session, *conditions) -> int:  # noqa: ANN002
    return int(db.scalar(select(func.count(Photo.id)).where(*conditions)) or 0)


def _stats(db: Session, trip: Trip) -> TripStats:
    scope = (Photo.trip_id == trip.id, Photo.deleted_at.is_(None))
    photo_count = _count(db, *scope)
    place_count = int(
        db.scalar(select(func.count(TripPlace.id)).where(TripPlace.trip_id == trip.id)) or 0
    )
    return TripStats(
        photo_count=photo_count,
        place_count=place_count,
        day_count=trip.day_count,
        photo_days=int(
            db.scalar(select(func.count(func.distinct(func.date(Photo.taken_at)))).where(*scope))
            or 0
        ),
        gps_photo_count=_count(
            db, *scope, Photo.latitude.is_not(None), Photo.longitude.is_not(None)
        ),
        favorite_count=_count(db, *scope, Photo.is_favorite.is_(True)),
        first_photo_at=db.scalar(select(func.min(Photo.taken_at)).where(*scope)),
        last_photo_at=db.scalar(select(func.max(Photo.taken_at)).where(*scope)),
    )


def get_trip_detail(db: Session, trip_id: UUID, user_id: UUID) -> TripDetailOut:
    trip = get_trip(db, trip_id, user_id)
    visits = _visits(db, trip.id)
    stats = _stats(db, trip)

    preview = list(
        db.scalars(
            select(Photo)
            .where(Photo.trip_id == trip.id, Photo.deleted_at.is_(None))
            .order_by(
                Photo.taken_at.is_(None),
                Photo.taken_at.asc(),
                Photo.created_at.desc(),
            )
            .limit(6)
        ).all()
    )

    cover = None
    if trip.cover_photo_id:
        cover = db.scalar(
            select(Photo).where(Photo.id == trip.cover_photo_id, Photo.deleted_at.is_(None))
        )

    base = trip_out(
        trip,
        photo_count=stats.photo_count,
        place_count=stats.place_count,
        cover_photo=cover,
    )
    return TripDetailOut(
        **base.model_dump(),
        places=[
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
        ],
        stats=stats,
        photos_preview=[photo_mini(photo) for photo in preview],
    )


def create_trip(db: Session, user_id: UUID, payload: TripCreate) -> Trip:
    trip = Trip(
        user_id=user_id,
        title=payload.title,
        description=payload.description,
        start_date=payload.start_date,
        end_date=payload.end_date,
        visibility=payload.visibility,
    )
    db.add(trip)
    db.flush()
    db.add(TripMember(trip_id=trip.id, user_id=user_id, role=MemberRole.owner))
    db.commit()
    db.refresh(trip)
    return trip


def _validate_final_dates(start: date | None, end: date | None) -> None:
    if start and end and end < start:
        raise UnprocessableError("end_date must be on or after start_date", code="invalid_dates")


def update_trip(db: Session, trip: Trip, payload: TripUpdate) -> Trip:
    data = payload.model_dump(exclude_unset=True)
    if "title" in data:
        title = (data["title"] or "").strip()
        if not title:
            raise BadRequestError("Trip title cannot be empty", code="invalid_title")
        trip.title = title
    if "description" in data:
        trip.description = data["description"]
    if "visibility" in data:
        trip.visibility = data["visibility"]

    start = data.get("start_date", trip.start_date)
    end = data.get("end_date", trip.end_date)
    _validate_final_dates(start, end)
    if "start_date" in data:
        trip.start_date = data["start_date"]
    if "end_date" in data:
        trip.end_date = data["end_date"]

    if "cover_photo_id" in data:
        cover_id = data["cover_photo_id"]
        if cover_id is None:
            trip.cover_photo_id = None
        else:
            photo = db.scalar(
                select(Photo).where(
                    Photo.id == cover_id,
                    Photo.user_id == trip.user_id,
                    Photo.trip_id == trip.id,
                    Photo.deleted_at.is_(None),
                )
            )
            if photo is None:
                raise BadRequestError(
                    "Cover photo must belong to this trip", code="invalid_cover_photo"
                )
            trip.cover_photo_id = photo.id

    db.commit()
    db.refresh(trip)
    return trip


def delete_trip(db: Session, trip: Trip) -> None:
    trip.deleted_at = datetime.now(timezone.utc)
    db.commit()


def restore_trip(db: Session, trip_id: UUID, user_id: UUID) -> Trip:
    trip = TripRepository.get_any(db, trip_id, user_id)
    if trip is None:
        raise NotFoundError("Trip not found")
    trip.deleted_at = None
    db.commit()
    db.refresh(trip)
    return trip
