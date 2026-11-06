"""Translate ORM objects into API schemas."""

from __future__ import annotations

from app.models import Photo, TimelineEvent, Trip
from app.schemas.photo import PhotoMini, PhotoOut
from app.schemas.place import PlaceSummary
from app.schemas.timeline import EventOut
from app.schemas.trip import TripOut


def place_summary(place) -> PlaceSummary | None:  # noqa: ANN001
    if place is None:
        return None
    return PlaceSummary(
        id=place.id,
        name=place.name,
        category=place.category,
        city=place.city,
        country=place.country,
        latitude=place.latitude,
        longitude=place.longitude,
    )


def photo_mini(photo: Photo) -> PhotoMini:
    return PhotoMini(
        id=photo.id,
        taken_at=photo.taken_at,
        latitude=photo.latitude,
        longitude=photo.longitude,
        is_favorite=photo.is_favorite,
        caption=photo.caption,
        width=photo.width,
        height=photo.height,
    )


def photo_out(photo: Photo) -> PhotoOut:
    place = photo.__dict__.get("place")
    return PhotoOut(
        id=photo.id,
        trip_id=photo.trip_id,
        place_id=photo.place_id,
        place=place_summary(place),
        original_filename=photo.original_filename,
        mime_type=photo.mime_type,
        file_size=photo.file_size,
        width=photo.width,
        height=photo.height,
        taken_at=photo.taken_at,
        taken_at_offset_minutes=photo.taken_at_offset_minutes,
        latitude=photo.latitude,
        longitude=photo.longitude,
        has_gps=photo.has_gps,
        gps_source=photo.gps_source,
        camera_make=photo.camera_make,
        camera_model=photo.camera_model,
        lens=photo.lens,
        caption=photo.caption,
        is_favorite=photo.is_favorite,
        status=photo.status,
        created_at=photo.created_at,
    )


def trip_out(
    trip: Trip,
    *,
    photo_count: int = 0,
    place_count: int = 0,
    cover_photo: Photo | None = None,
) -> TripOut:
    return TripOut(
        id=trip.id,
        title=trip.title,
        description=trip.description,
        start_date=trip.start_date,
        end_date=trip.end_date,
        visibility=trip.visibility,
        cover_photo_id=trip.cover_photo_id,
        cover_photo=photo_mini(cover_photo) if cover_photo else None,
        day_count=trip.day_count,
        photo_count=photo_count,
        place_count=place_count,
        created_at=trip.created_at,
        updated_at=trip.updated_at,
    )


def event_out(event: TimelineEvent) -> EventOut:
    photos = []
    for media in event.media:
        photo = media.photo
        if photo is not None and photo.deleted_at is None:
            photos.append(photo_mini(photo))
    return EventOut(
        id=event.id,
        trip_id=event.trip_id,
        title=event.title,
        description=event.description,
        event_type=event.event_type,
        start_time=event.start_time,
        end_time=event.end_time,
        day=event.day,
        sort_order=event.sort_order,
        source=event.source,
        status=event.status,
        place=place_summary(event.__dict__.get("place")),
        photos=photos,
    )
