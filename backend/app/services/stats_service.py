"""Dashboard statistics."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import Photo, Place, Trip
from app.repositories import PhotoRepository
from app.schemas.map import CountryStat, StatsOverview, YearStat
from app.schemas.photo import PhotoMini
from app.services import trip_service
from app.services.photo_service import storage_usage


def overview(db: Session, user_id: UUID) -> StatsOverview:
    trip_rows = db.execute(
        select(Trip.start_date, Trip.end_date).where(
            Trip.user_id == user_id, Trip.deleted_at.is_(None)
        )
    ).all()
    trips_count = len(trip_rows)
    days = sum(
        max((end - start).days + 1, 1)
        for start, end in trip_rows
        if start is not None and end is not None
    )

    photos_count = int(
        db.scalar(
            select(func.count()).select_from(PhotoRepository.visible_query(user_id).subquery())
        )
        or 0
    )
    gps_photos = int(
        db.scalar(
            select(func.count(Photo.id)).where(
                Photo.user_id == user_id,
                Photo.deleted_at.is_(None),
                Photo.latitude.is_not(None),
                Photo.longitude.is_not(None),
            )
        )
        or 0
    )
    favorites = int(
        db.scalar(
            select(func.count(Photo.id)).where(
                Photo.user_id == user_id,
                Photo.deleted_at.is_(None),
                Photo.is_favorite.is_(True),
            )
        )
        or 0
    )
    places_count = int(db.scalar(select(func.count(Place.id)).where(Place.user_id == user_id)) or 0)

    country_rows = db.execute(
        select(Place.country, Place.country_code, func.count(Place.id))
        .where(Place.user_id == user_id, Place.country.is_not(None))
        .group_by(Place.country, Place.country_code)
    ).all()
    photo_country_rows = db.execute(
        select(Place.country, func.count(Photo.id))
        .join(Photo, Photo.place_id == Place.id)
        .where(Photo.user_id == user_id, Photo.deleted_at.is_(None), Place.country.is_not(None))
        .group_by(Place.country)
    ).all()
    photo_countries = {country: count for country, count in photo_country_rows}
    countries_detail = sorted(
        [
            CountryStat(
                country=country,
                country_code=code,
                place_count=count,
                photo_count=photo_countries.get(country, 0),
            )
            for country, code, count in country_rows
        ],
        key=lambda item: item.place_count,
        reverse=True,
    )

    city_rows = db.execute(
        select(Place.country, Place.city)
        .where(Place.user_id == user_id, Place.city.is_not(None))
        .distinct()
    ).all()
    cities = {(country, city) for country, city in city_rows}

    trip_years: dict[int, int] = {}
    for start, end in trip_rows:
        year = start or end
        if year is not None:
            trip_years[year.year] = trip_years.get(year.year, 0) + 1
    photo_years: dict[int, int] = {}
    for (taken_at,) in db.execute(
        select(Photo.taken_at).where(
            Photo.user_id == user_id, Photo.deleted_at.is_(None), Photo.taken_at.is_not(None)
        )
    ).all():
        photo_years[taken_at.year] = photo_years.get(taken_at.year, 0) + 1
    years = [
        YearStat(year=year, trips=trip_years.get(year, 0), photos=photo_years.get(year, 0))
        for year in sorted(set(trip_years) | set(photo_years), reverse=True)
    ]

    recent_page = trip_service.list_trips(db, user_id, page=1, size=4)
    recent_photos = db.scalars(
        PhotoRepository.visible_query(user_id)
        .options(selectinload(Photo.place))
        .order_by(Photo.created_at.desc())
        .limit(8)
    ).all()

    return StatsOverview(
        trips=trips_count,
        countries=len(countries_detail),
        cities=len(cities),
        places=places_count,
        photos=photos_count,
        days=days,
        favorite_photos=favorites,
        gps_photos=gps_photos,
        storage_bytes=storage_usage(db, user_id),
        years=years,
        countries_detail=countries_detail,
        recent_trips=recent_page.items,
        recent_photos=[
            PhotoMini(
                id=photo.id,
                taken_at=photo.taken_at,
                latitude=photo.latitude,
                longitude=photo.longitude,
                is_favorite=photo.is_favorite,
                caption=photo.caption,
                width=photo.width,
                height=photo.height,
            )
            for photo in recent_photos
        ],
    )
