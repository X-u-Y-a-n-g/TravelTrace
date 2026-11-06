"""Full trip export as a portable ZIP archive."""

from __future__ import annotations

import json
import re
import shutil
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models import Photo, Place, TripPlace
from app.services import timeline_service, trip_service
from app.services.storage import safe_filename, storage


def _slug(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-._")
    return cleaned[:60] or "trip"


def _dump(path: Path, payload: object) -> None:
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False, default=str), encoding="utf-8"
    )


def build_export(
    db: Session, trip_id: UUID, user_id: UUID, *, include_originals: bool = True
) -> Path:
    trip = trip_service.get_trip(db, trip_id, user_id)
    detail = trip_service.get_trip_detail(db, trip_id, user_id)
    timeline = timeline_service.get_timeline(db, trip_id, user_id)

    photos = list(
        db.scalars(
            select(Photo)
            .options(selectinload(Photo.place))
            .where(Photo.trip_id == trip.id, Photo.deleted_at.is_(None))
            .order_by(Photo.taken_at.is_(None), Photo.taken_at.asc(), Photo.created_at.asc())
        ).all()
    )
    visits = list(
        db.execute(
            select(TripPlace, Place)
            .join(Place, Place.id == TripPlace.place_id)
            .where(TripPlace.trip_id == trip.id)
            .order_by(TripPlace.sort_order, TripPlace.arrival_time)
        ).all()
    )

    export_root = Path(
        tempfile.mkdtemp(prefix=f"traveltrace-export-{_slug(trip.title)}-", dir=settings.data_dir)
    )
    try:
        photos_dir = export_root / "photos"
        photos_dir.mkdir(parents=True, exist_ok=True)

        photo_entries = []
        for index, photo in enumerate(photos, start=1):
            filename = f"{index:04d}_{safe_filename(photo.original_filename)}"
            entry = {
                "id": str(photo.id),
                "file": f"photos/{filename}" if include_originals else None,
                "original_filename": photo.original_filename,
                "taken_at": photo.taken_at,
                "taken_at_offset_minutes": photo.taken_at_offset_minutes,
                "latitude": photo.latitude,
                "longitude": photo.longitude,
                "gps_source": photo.gps_source.value,
                "camera_make": photo.camera_make,
                "camera_model": photo.camera_model,
                "lens": photo.lens,
                "caption": photo.caption,
                "is_favorite": photo.is_favorite,
                "place_id": str(photo.place_id) if photo.place_id else None,
                "width": photo.width,
                "height": photo.height,
                "metadata": photo.photo_metadata,
            }
            photo_entries.append(entry)
            if include_originals:
                source = storage.resolve(photo.file_path)
                if source.is_file():
                    shutil.copy2(source, photos_dir / filename)

        features = []
        for visit, place in visits:
            if place.latitude is None or place.longitude is None:
                continue
            features.append(
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [place.longitude, place.latitude],
                    },
                    "properties": {
                        "id": str(place.id),
                        "name": place.name,
                        "category": place.category.value,
                        "address": place.address,
                        "city": place.city,
                        "region": place.region,
                        "country": place.country,
                        "country_code": place.country_code,
                        "arrival_time": visit.arrival_time,
                        "departure_time": visit.departure_time,
                        "sort_order": visit.sort_order,
                        "notes": visit.notes,
                    },
                }
            )

        _dump(export_root / "trip.json", detail.model_dump(mode="json"))
        _dump(
            export_root / "timeline.json",
            {
                "trip_id": str(trip.id),
                "days": [day.model_dump(mode="json") for day in timeline.days],
                "event_count": timeline.event_count,
            },
        )
        _dump(
            export_root / "places.geojson",
            {"type": "FeatureCollection", "features": features},
        )
        _dump(export_root / "photos.json", photo_entries)
        _dump(
            export_root / "manifest.json",
            {
                "format_version": "1.0",
                "application": "TravelTrace",
                "application_version": settings.app_version,
                "exported_at": datetime.now(timezone.utc).isoformat(),
                "trip": {
                    "id": str(trip.id),
                    "title": trip.title,
                    "start_date": trip.start_date,
                    "end_date": trip.end_date,
                },
                "counts": {
                    "photos": len(photos),
                    "places": len(visits),
                    "timeline_events": timeline.event_count,
                },
                "includes_originals": include_originals,
                "layout": {
                    "trip.json": "Trip metadata and statistics",
                    "timeline.json": "Timeline events grouped by day",
                    "places.geojson": "Visited places as GeoJSON",
                    "photos.json": "Photo metadata",
                    "photos/": "Original photo files" if include_originals else None,
                },
            },
        )
        (export_root / "README.txt").write_text(
            "TravelTrace export\n"
            "=================\n\n"
            "This archive contains your trip data in open formats.\n"
            "- trip.json     : trip metadata and statistics\n"
            "- timeline.json : timeline events grouped by day\n"
            "- places.geojson: visited places (RFC 7946 GeoJSON)\n"
            "- photos.json   : photo metadata, including GPS and EXIF fields\n"
            "- photos/       : original photo files\n"
            "- manifest.json : export metadata and counts\n\n"
            "Coordinates use WGS84 (EPSG:4326). Timestamps are local wall-clock\n"
            "times as recorded by the camera, unless an offset is provided.\n",
            encoding="utf-8",
        )

        archive = settings.data_dir / f"traveltrace-{_slug(trip.title)}-{trip.id.hex[:8]}.zip"
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
            for file in sorted(export_root.rglob("*")):
                if file.is_file():
                    bundle.write(file, file.relative_to(export_root).as_posix())
        return archive
    finally:
        shutil.rmtree(export_root, ignore_errors=True)
