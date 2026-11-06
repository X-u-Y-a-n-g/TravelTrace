"""Timeline business logic: manual events plus rule-based draft generation."""

from __future__ import annotations

from collections import Counter
from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import BadRequestError, NotFoundError
from app.models import EventMedia, Photo, Place, TimelineEvent
from app.models.enums import EventSource, EventStatus, EventType, PlaceCategory
from app.processors.clustering import PhotoPoint, cluster_photos
from app.repositories import TripRepository
from app.schemas.timeline import (
    EventCreate,
    EventOut,
    EventUpdate,
    GenerateTimelineRequest,
    TimelineDay,
    TimelineGenerateResult,
    TimelineOut,
)
from app.services.serializers import event_out

CATEGORY_TO_EVENT: dict[PlaceCategory, EventType] = {
    PlaceCategory.attraction: EventType.sightseeing,
    PlaceCategory.food: EventType.food,
    PlaceCategory.lodging: EventType.lodging,
    PlaceCategory.transport: EventType.transport,
    PlaceCategory.nature: EventType.sightseeing,
    PlaceCategory.shopping: EventType.activity,
    PlaceCategory.other: EventType.other,
}


def _events_stmt(trip_id: UUID):  # noqa: ANN202
    return (
        select(TimelineEvent)
        .options(
            selectinload(TimelineEvent.place),
            selectinload(TimelineEvent.media)
            .selectinload(EventMedia.photo)
            .selectinload(Photo.place),
        )
        .where(TimelineEvent.trip_id == trip_id)
        .order_by(TimelineEvent.day, TimelineEvent.start_time, TimelineEvent.sort_order)
    )


def _load_event(db: Session, event_id: UUID) -> TimelineEvent:
    event = db.scalar(
        select(TimelineEvent)
        .options(
            selectinload(TimelineEvent.place),
            selectinload(TimelineEvent.media)
            .selectinload(EventMedia.photo)
            .selectinload(Photo.place),
        )
        .where(TimelineEvent.id == event_id)
        .execution_options(populate_existing=True)
    )
    if event is None:
        raise NotFoundError("Timeline event not found")
    return event


def _build_timeline(db: Session, trip_id: UUID, start_date=None) -> TimelineOut:  # noqa: ANN001
    events = db.scalars(_events_stmt(trip_id)).all()
    grouped: dict = {}
    for event in events:
        grouped.setdefault(event.day, []).append(event)

    days: list[TimelineDay] = []
    for index, day in enumerate(sorted(grouped)):
        if start_date is not None:
            day_index = (day - start_date).days + 1
            if day_index < 1:
                day_index = index + 1
        else:
            day_index = index + 1
        days.append(
            TimelineDay(
                date=day, day_index=day_index, events=[event_out(event) for event in grouped[day]]
            )
        )

    photo_ids: set[UUID] = set()
    for event in events:
        for media in event.media:
            if media.photo is not None and media.photo.deleted_at is None:
                photo_ids.add(media.photo_id)

    return TimelineOut(
        trip_id=trip_id,
        start_date=start_date,
        end_date=None,
        days=days,
        event_count=len(events),
        photo_count=len(photo_ids),
    )


def get_timeline(db: Session, trip_id: UUID, user_id: UUID) -> TimelineOut:
    trip = TripRepository.get(db, trip_id, user_id)
    timeline = _build_timeline(db, trip.id, trip.start_date)
    timeline.start_date = trip.start_date
    timeline.end_date = trip.end_date
    return timeline


def _validate_photo_ids(
    db: Session, trip_id: UUID, user_id: UUID, photo_ids: list[UUID]
) -> list[Photo]:
    if not photo_ids:
        return []
    photos = db.scalars(
        select(Photo).where(
            Photo.id.in_(photo_ids),
            Photo.user_id == user_id,
            Photo.deleted_at.is_(None),
        )
    ).all()
    found = {photo.id: photo for photo in photos}
    missing = [str(photo_id) for photo_id in photo_ids if photo_id not in found]
    if missing:
        raise BadRequestError(
            "Some photos were not found", code="photos_not_found", details=missing
        )
    for photo in photos:
        if photo.trip_id is not None and photo.trip_id != trip_id:
            raise BadRequestError("Photos must belong to the same trip", code="photo_trip_mismatch")
        if photo.trip_id is None:
            photo.trip_id = trip_id
    ordered = [found[photo_id] for photo_id in photo_ids]
    return ordered


def _attach_media(db: Session, event: TimelineEvent, photos: list[Photo]) -> None:
    for order, photo in enumerate(photos):
        db.add(EventMedia(event_id=event.id, photo_id=photo.id, sort_order=order))


def create_event(db: Session, trip_id: UUID, user_id: UUID, payload: EventCreate) -> EventOut:
    trip = TripRepository.get(db, trip_id, user_id)
    place = None
    if payload.place_id is not None:
        place = db.scalar(
            select(Place).where(Place.id == payload.place_id, Place.user_id == user_id)
        )
        if place is None:
            raise NotFoundError("Place not found")
    photos = _validate_photo_ids(db, trip.id, user_id, payload.photo_ids)

    start_time = payload.start_time.replace(tzinfo=None)
    end_time = payload.end_time.replace(tzinfo=None) if payload.end_time else None
    if end_time and end_time < start_time:
        raise BadRequestError("end_time must be after start_time", code="invalid_event_times")

    event = TimelineEvent(
        trip_id=trip.id,
        place_id=place.id if place else None,
        title=payload.title.strip(),
        description=payload.description,
        event_type=payload.event_type,
        start_time=start_time,
        end_time=end_time,
        day=start_time.date(),
        sort_order=0,
        source=EventSource.manual,
        status=EventStatus.confirmed,
    )
    db.add(event)
    db.flush()
    _attach_media(db, event, photos)
    db.commit()
    return event_out(_load_event(db, event.id))


def update_event(db: Session, event: TimelineEvent, payload: EventUpdate) -> EventOut:
    data = payload.model_dump(exclude_unset=True)
    if "title" in data and data["title"] is not None:
        title = data["title"].strip()
        if not title:
            raise BadRequestError("Event title cannot be empty", code="invalid_title")
        event.title = title
    if "description" in data:
        event.description = data["description"]
    if "event_type" in data and data["event_type"] is not None:
        event.event_type = data["event_type"]
    if "place_id" in data:
        if data["place_id"] is None:
            event.place_id = None
        else:
            place = db.scalar(
                select(Place).where(
                    Place.id == data["place_id"], Place.user_id == event.trip.user_id
                )
            )
            if place is None:
                raise NotFoundError("Place not found")
            event.place_id = place.id
    if "start_time" in data and data["start_time"] is not None:
        event.start_time = data["start_time"].replace(tzinfo=None)
        event.day = event.start_time.date()
    if "end_time" in data:
        event.end_time = data["end_time"].replace(tzinfo=None) if data["end_time"] else None
    if event.end_time and event.end_time < event.start_time:
        raise BadRequestError("end_time must be after start_time", code="invalid_event_times")
    if "status" in data and data["status"] is not None:
        event.status = data["status"]

    if "photo_ids" in data and data["photo_ids"] is not None:
        photos = _validate_photo_ids(db, event.trip_id, event.trip.user_id, data["photo_ids"])
        db.execute(delete(EventMedia).where(EventMedia.event_id == event.id))
        db.flush()
        _attach_media(db, event, photos)

    db.commit()
    return event_out(_load_event(db, event.id))


def delete_event(db: Session, event: TimelineEvent) -> None:
    db.delete(event)
    db.commit()


def get_event(db: Session, trip_id: UUID, event_id: UUID, user_id: UUID) -> TimelineEvent:
    trip = TripRepository.get(db, trip_id, user_id)
    event = db.scalar(
        select(TimelineEvent).where(TimelineEvent.id == event_id, TimelineEvent.trip_id == trip.id)
    )
    if event is None:
        raise NotFoundError("Timeline event not found")
    return event


def attach_photos(
    db: Session, event: TimelineEvent, photo_ids: list[UUID], user_id: UUID
) -> EventOut:
    photos = _validate_photo_ids(db, event.trip_id, user_id, photo_ids)
    existing = {media.photo_id for media in event.media}
    next_order = max((media.sort_order for media in event.media), default=-1) + 1
    for photo in photos:
        if photo.id not in existing:
            db.add(EventMedia(event_id=event.id, photo_id=photo.id, sort_order=next_order))
            next_order += 1
    db.commit()
    return event_out(_load_event(db, event.id))


def detach_photo(db: Session, event: TimelineEvent, photo_id: UUID) -> EventOut:
    db.execute(
        delete(EventMedia).where(EventMedia.event_id == event.id, EventMedia.photo_id == photo_id)
    )
    db.commit()
    return event_out(_load_event(db, event.id))


def _period_of_day(moment: datetime) -> str:
    if moment.hour < 6:
        return "Early morning"
    if moment.hour < 12:
        return "Morning"
    if moment.hour < 17:
        return "Afternoon"
    if moment.hour < 21:
        return "Evening"
    return "Night"


def generate_timeline(
    db: Session, trip_id: UUID, user_id: UUID, payload: GenerateTimelineRequest
) -> TimelineGenerateResult:
    trip = TripRepository.get(db, trip_id, user_id)

    manual_assigned = set(
        db.scalars(
            select(EventMedia.photo_id)
            .join(TimelineEvent, TimelineEvent.id == EventMedia.event_id)
            .where(
                TimelineEvent.trip_id == trip.id,
                or_(
                    TimelineEvent.source == EventSource.manual,
                    TimelineEvent.status == EventStatus.confirmed,
                ),
            )
        ).all()
    )

    auto_event_ids = list(
        db.scalars(
            select(TimelineEvent.id).where(
                TimelineEvent.trip_id == trip.id, TimelineEvent.source == EventSource.auto
            )
        ).all()
    )

    if payload.replace_auto and auto_event_ids:
        db.execute(delete(EventMedia).where(EventMedia.event_id.in_(auto_event_ids)))
        db.execute(delete(TimelineEvent).where(TimelineEvent.id.in_(auto_event_ids)))
        db.flush()

    if not payload.replace_auto and auto_event_ids:
        auto_assigned = set(
            db.scalars(
                select(EventMedia.photo_id).where(EventMedia.event_id.in_(auto_event_ids))
            ).all()
        )
        manual_assigned |= auto_assigned

    photos = db.scalars(
        select(Photo)
        .where(
            Photo.trip_id == trip.id,
            Photo.deleted_at.is_(None),
            Photo.taken_at.is_not(None),
        )
        .order_by(Photo.taken_at)
    ).all()

    points = [
        PhotoPoint(
            id=photo.id,
            taken_at=photo.taken_at,  # type: ignore[arg-type]
            latitude=photo.latitude,
            longitude=photo.longitude,
            place_id=photo.place_id,
        )
        for photo in photos
        if photo.id not in manual_assigned and photo.taken_at is not None
    ]

    place_ids = {point.place_id for point in points if point.place_id}
    places = (
        {
            place.id: place
            for place in db.scalars(select(Place).where(Place.id.in_(place_ids))).all()
        }
        if place_ids
        else {}
    )

    clusters = cluster_photos(
        points,
        max_gap_minutes=payload.max_gap_minutes,
        max_distance_km=payload.max_distance_km,
    )

    created = 0
    assigned = 0
    for order, cluster in enumerate(clusters):
        place = places.get(cluster.place_id) if cluster.place_id else None
        cities = Counter(
            places[point.place_id].city
            for point in cluster.photos
            if point.place_id in places and places[point.place_id].city
        )
        city = cities.most_common(1)[0][0] if cities else None
        period = _period_of_day(cluster.start_time)
        if place is not None:
            title = place.name
        elif city:
            title = f"{period} in {city}"
        else:
            title = f"{period} moments"

        event = TimelineEvent(
            trip_id=trip.id,
            place_id=place.id if place else None,
            title=title,
            description=None,
            event_type=CATEGORY_TO_EVENT.get(place.category, EventType.other)
            if place
            else EventType.other,
            start_time=cluster.start_time.replace(second=0, microsecond=0),
            end_time=cluster.end_time.replace(second=0, microsecond=0),
            day=cluster.day,
            sort_order=order,
            source=EventSource.auto,
            status=EventStatus.draft,
        )
        db.add(event)
        db.flush()
        for index, point in enumerate(cluster.photos):
            db.add(EventMedia(event_id=event.id, photo_id=point.id, sort_order=index))
        created += 1
        assigned += len(cluster.photos)

    db.commit()

    timeline = get_timeline(db, trip.id, user_id)
    return TimelineGenerateResult(
        created_events=created,
        assigned_photos=assigned,
        kept_manual_events=len(manual_assigned),
        timeline=timeline,
    )
