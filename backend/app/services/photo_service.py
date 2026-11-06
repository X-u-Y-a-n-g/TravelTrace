"""Photo upload, EXIF processing, thumbnails and library management."""

from __future__ import annotations

import hashlib
import logging
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload
from starlette.datastructures import UploadFile

from app.core.config import settings
from app.core.errors import (
    BadRequestError,
    NotFoundError,
    PayloadTooLargeError,
    UnprocessableError,
)
from app.core.geo import bounding_box, haversine_m
from app.db.session import SessionLocal
from app.models import EventMedia, ImportTask, Photo, Place, Trip
from app.models.enums import GpsSource, ImportStatus, ImportType, PhotoStatus
from app.processors.exif_processor import inspect_image
from app.processors.thumbnails import generate_derivatives
from app.repositories import PhotoRepository, PlaceRepository, TripRepository
from app.schemas.common import Page
from app.schemas.photo import PhotoOut, PhotoUpdate
from app.services.serializers import photo_out
from app.services.storage import safe_filename, storage
from app.tasks.queue import get_task_runner

logger = logging.getLogger(__name__)

CHUNK_SIZE = 1024 * 1024
PLACE_MATCH_RADIUS_M = 150.0


# ---------------------------------------------------------------------------
# Upload intake
# ---------------------------------------------------------------------------


def _save_upload(upload: UploadFile, destination: Path, max_bytes: int) -> int:
    size = 0
    try:
        with destination.open("wb") as handle:
            while True:
                chunk = upload.file.read(CHUNK_SIZE)
                if not chunk:
                    break
                size += len(chunk)
                if size > max_bytes:
                    raise PayloadTooLargeError(
                        f"Each photo must be smaller than {settings.max_upload_mb} MB",
                        code="file_too_large",
                    )
                handle.write(chunk)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    if size == 0:
        destination.unlink(missing_ok=True)
        raise BadRequestError("Uploaded file is empty", code="empty_file")
    return size


def create_import_task(
    db: Session,
    user_id: UUID,
    uploads: list[UploadFile],
    *,
    trip_id: UUID | None = None,
    place_id: UUID | None = None,
) -> ImportTask:
    if not uploads:
        raise BadRequestError("No photos were uploaded", code="no_files")
    if len(uploads) > settings.max_upload_files:
        raise BadRequestError(
            f"You can upload at most {settings.max_upload_files} photos at a time",
            code="too_many_files",
        )

    if trip_id is not None:
        TripRepository.get(db, trip_id, user_id)
    if place_id is not None:
        PlaceRepository.get(db, place_id, user_id)

    task = ImportTask(
        user_id=user_id,
        trip_id=trip_id,
        task_type=ImportType.photo_import,
        status=ImportStatus.queued,
        total=len(uploads),
        payload={
            "place_id": str(place_id) if place_id else None,
            "files": [],
        },
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    incoming = storage.incoming_dir(user_id, task.id)
    max_bytes = settings.max_upload_mb * 1024 * 1024
    saved: list[dict] = []
    try:
        for index, upload in enumerate(uploads):
            original = Path(upload.filename or f"photo-{index + 1}").name
            display_name = original[:255] or f"photo-{index + 1}"
            destination = incoming / f"{index:04d}_{safe_filename(display_name)}"
            size = _save_upload(upload, destination, max_bytes)
            saved.append(
                {
                    "path": storage.relative(destination),
                    "filename": display_name,
                    "size": size,
                }
            )
    except Exception:
        storage.cleanup_task_dir(user_id, task.id)
        db.delete(task)
        db.commit()
        raise

    task.payload = {"place_id": str(place_id) if place_id else None, "files": saved}
    db.commit()
    db.refresh(task)

    get_task_runner().submit_photo_import(task.id)
    db.refresh(task)
    return task


# ---------------------------------------------------------------------------
# Processing pipeline
# ---------------------------------------------------------------------------


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _infer_trip(db: Session, user_id: UUID, taken_at: datetime | None) -> UUID | None:
    if taken_at is None:
        return None
    trip = TripRepository.find_overlapping(db, user_id, taken_at.date())
    return trip.id if trip else None


def _infer_place(
    db: Session, user_id: UUID, latitude: float | None, longitude: float | None
) -> UUID | None:
    if latitude is None or longitude is None:
        return None
    min_lat, max_lat, min_lon, max_lon = bounding_box(latitude, longitude, PLACE_MATCH_RADIUS_M * 2)
    candidates = db.scalars(
        select(Place).where(
            Place.user_id == user_id,
            Place.latitude.is_not(None),
            Place.longitude.is_not(None),
            Place.latitude.between(min_lat, max_lat),
            Place.longitude.between(min_lon, max_lon),
        )
    ).all()
    best: Place | None = None
    best_distance = float("inf")
    for place in candidates:
        distance = haversine_m(latitude, longitude, place.latitude, place.longitude)  # type: ignore[arg-type]
        if distance < best_distance:
            best, best_distance = place, distance
    if best is not None and best_distance <= PLACE_MATCH_RADIUS_M:
        return best.id
    return None


def _process_single_file(db: Session, task: ImportTask, item: dict) -> dict:
    incoming = storage.resolve(item["path"])
    if not incoming.is_file():
        raise BadRequestError("Uploaded file is missing", code="missing_upload")

    digest = _sha256(incoming)
    existing = db.scalar(
        select(Photo).where(Photo.user_id == task.user_id, Photo.content_hash == digest)
    )
    if existing is not None and existing.deleted_at is None:
        storage.delete(item["path"])
        return {"status": "skipped", "photo_id": existing.id, "reason": "duplicate"}

    info = inspect_image(incoming)
    photo_id = existing.id if existing is not None else uuid.uuid4()

    preview = storage.derived_path(task.user_id, photo_id, "preview")
    thumb = storage.derived_path(task.user_id, photo_id, "thumb")
    width, height = generate_derivatives(incoming, preview, thumb)

    final = storage.final_path(task.user_id, photo_id, info.extension)
    old_paths = [existing.file_path, existing.preview_path, existing.thumb_path] if existing else []
    shutil.move(str(incoming), str(final))

    trip_id = task.trip_id or _infer_trip(db, task.user_id, info.taken_at)
    place_id = None
    raw_place = (task.payload or {}).get("place_id")
    if raw_place:
        try:
            place_id = UUID(str(raw_place))
        except (ValueError, TypeError):
            place_id = None
    if place_id is None:
        place_id = _infer_place(db, task.user_id, info.latitude, info.longitude)

    photo = existing
    if photo is None:
        photo = Photo(id=photo_id, user_id=task.user_id, content_hash=digest)
    photo.file_path = storage.relative(final)
    photo.preview_path = storage.relative(preview)
    photo.thumb_path = storage.relative(thumb)
    photo.original_filename = str(item.get("filename") or final.name)[:255]
    photo.mime_type = info.mime_type
    photo.file_size = int(item.get("size") or final.stat().st_size)
    photo.width = width
    photo.height = height
    photo.taken_at = info.taken_at
    photo.taken_at_offset_minutes = info.taken_at_offset_minutes
    photo.latitude = info.latitude
    photo.longitude = info.longitude
    photo.gps_source = GpsSource.exif if info.latitude is not None else GpsSource.none
    photo.camera_make = info.camera_make
    photo.camera_model = info.camera_model
    photo.lens = info.lens
    photo.orientation = info.orientation
    photo.photo_metadata = info.metadata
    photo.status = PhotoStatus.ready
    photo.error_message = None
    photo.deleted_at = None
    if photo.trip_id is None:
        photo.trip_id = trip_id
    if photo.place_id is None:
        photo.place_id = place_id

    db.add(photo)
    db.flush()

    for old in old_paths:
        if old and old not in {photo.file_path, photo.preview_path, photo.thumb_path}:
            storage.delete(old)

    return {
        "status": "imported",
        "photo_id": photo.id,
        "has_gps": photo.latitude is not None,
    }


def _finalise(
    db: Session,
    task: ImportTask,
    *,
    imported: list[dict],
    skipped: list[dict],
    failures: list[dict],
    cancelled: bool,
) -> None:
    task = db.get(ImportTask, task.id) or task
    now = datetime.now(timezone.utc)
    task.finished_at = now
    task.failed = len(failures)
    task.result = {
        "imported": len(imported),
        "skipped": len(skipped),
        "failed": len(failures),
        "photo_ids": [str(entry["photo_id"]) for entry in imported if entry.get("photo_id")],
        "errors": failures[:20],
        "skipped_files": [entry.get("filename") for entry in skipped][:50],
    }
    if cancelled:
        task.status = ImportStatus.cancelled
        task.message = "Import cancelled"
    elif not imported and not skipped and failures:
        task.status = ImportStatus.failed
        task.message = "No photos could be imported"
        task.error = failures[0].get("error")
    elif failures:
        task.status = ImportStatus.partial
        task.message = f"Imported {len(imported)}, skipped {len(skipped)}, failed {len(failures)}"
    else:
        task.status = ImportStatus.succeeded
        if imported:
            task.message = f"Imported {len(imported)} photo{'s' if len(imported) != 1 else ''}"
            if skipped:
                task.message += (
                    f", skipped {len(skipped)} duplicate{'s' if len(skipped) != 1 else ''}"
                )
        else:
            task.message = "All photos were already in your library"
    task.progress = 100
    db.commit()


def process_import_task(task_id: UUID) -> None:
    db = SessionLocal()
    try:
        task = db.get(ImportTask, task_id)
        if task is None:
            return
        if task.status == ImportStatus.cancelled:
            return

        task.status = ImportStatus.running
        task.started_at = datetime.now(timezone.utc)
        task.message = "Reading photo metadata"
        db.commit()

        items = list((task.payload or {}).get("files") or [])
        imported: list[dict] = []
        skipped: list[dict] = []
        failures: list[dict] = []

        for index, item in enumerate(items):
            db.refresh(task)
            if task.status == ImportStatus.cancelled:
                break
            try:
                outcome = _process_single_file(db, task, item)
                db.commit()
                if outcome["status"] == "imported":
                    imported.append(outcome)
                else:
                    outcome["filename"] = item.get("filename")
                    skipped.append(outcome)
            except Exception as exc:  # noqa: BLE001 - per-file isolation
                db.rollback()
                logger.exception("Photo import failed for %s", item.get("filename"))
                failures.append(
                    {"file": item.get("filename"), "error": str(getattr(exc, "message", exc))}
                )

            task = db.get(ImportTask, task_id)
            if task is None:  # pragma: no cover - task deleted mid-flight
                return
            task.processed = index + 1
            task.failed = len(failures)
            task.progress = int(round(task.processed / max(task.total, 1) * 100))
            task.message = f"Processing photo {task.processed} of {task.total}"
            db.commit()

        task = db.get(ImportTask, task_id)
        if task is None:  # pragma: no cover
            return
        cancelled = task.status == ImportStatus.cancelled
        try:
            _finalise(
                db, task, imported=imported, skipped=skipped, failures=failures, cancelled=cancelled
            )
        except Exception as exc:  # noqa: BLE001 - never leave a task stuck in "running"
            db.rollback()
            logger.exception("Could not finalise import task %s", task_id)
            task = db.get(ImportTask, task_id)
            if task is not None:
                task.status = ImportStatus.failed
                task.progress = 100
                task.error = str(exc)
                task.finished_at = datetime.now(timezone.utc)
                db.commit()
        storage.cleanup_task_dir(task.user_id, task_id)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Library queries
# ---------------------------------------------------------------------------

SORT_OPTIONS = {
    "taken_at_desc": (Photo.taken_at.is_(None), Photo.taken_at.desc(), Photo.created_at.desc()),
    "taken_at_asc": (Photo.taken_at.is_(None), Photo.taken_at.asc(), Photo.created_at.asc()),
    "created_desc": (Photo.created_at.desc(),),
    "created_asc": (Photo.created_at.asc(),),
}


def list_photos(
    db: Session,
    user_id: UUID,
    *,
    page: int,
    size: int,
    trip_id: UUID | None = None,
    place_id: UUID | None = None,
    unsorted: bool = False,
    has_gps: bool | None = None,
    is_favorite: bool | None = None,
    date_from=None,  # noqa: ANN001
    date_to=None,  # noqa: ANN001
    query: str | None = None,
    camera: str | None = None,
    sort: str = "taken_at_desc",
) -> Page:  # noqa: ANN201
    stmt = PhotoRepository.apply_filters(
        PhotoRepository.visible_query(user_id),
        trip_id=trip_id,
        place_id=place_id,
        unsorted=unsorted,
        has_gps=has_gps,
        is_favorite=is_favorite,
        date_from=date_from,
        date_to=date_to,
        query=query,
        camera=camera,
    )
    total = int(db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
    ordering = SORT_OPTIONS.get(sort, SORT_OPTIONS["taken_at_desc"])
    photos = db.scalars(
        stmt.options(selectinload(Photo.place))
        .order_by(*ordering)
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    return Page.build([photo_out(photo) for photo in photos], total, page, size)


def get_photo(db: Session, photo_id: UUID, user_id: UUID) -> PhotoOut:
    return photo_out(PhotoRepository.get(db, photo_id, user_id))


def update_photo(db: Session, photo: Photo, payload: PhotoUpdate) -> Photo:
    data = payload.model_dump(exclude_unset=True)

    if "trip_id" in data:
        new_trip_id = data["trip_id"]
        if new_trip_id is not None:
            TripRepository.get(db, new_trip_id, photo.user_id)
        if new_trip_id != photo.trip_id:
            db.execute(delete(EventMedia).where(EventMedia.photo_id == photo.id))
            photo.trip_id = new_trip_id

    if "place_id" in data:
        new_place_id = data["place_id"]
        if new_place_id is not None:
            PlaceRepository.get(db, new_place_id, photo.user_id)
        photo.place_id = new_place_id

    latitude = data.get("latitude", photo.latitude)
    longitude = data.get("longitude", photo.longitude)
    if "latitude" in data or "longitude" in data:
        if (latitude is None) != (longitude is None):
            raise UnprocessableError(
                "latitude and longitude must be provided together", code="invalid_coordinates"
            )
        photo.latitude = latitude
        photo.longitude = longitude
        photo.gps_source = GpsSource.none if latitude is None else GpsSource.manual

    if "taken_at" in data:
        photo.taken_at = data["taken_at"]
    if "caption" in data:
        photo.caption = data["caption"]
    if "is_favorite" in data and data["is_favorite"] is not None:
        photo.is_favorite = bool(data["is_favorite"])

    db.commit()
    db.refresh(photo)
    return photo


def bulk_update(
    db: Session,
    user_id: UUID,
    photo_ids: list[UUID],
    *,
    trip_id: UUID | None = None,
    place_id: UUID | None = None,
    is_favorite: bool | None = None,
) -> int:
    if trip_id is not None:
        TripRepository.get(db, trip_id, user_id)
    if place_id is not None:
        PlaceRepository.get(db, place_id, user_id)

    photos = db.scalars(
        select(Photo).where(
            Photo.id.in_(photo_ids),
            Photo.user_id == user_id,
            Photo.deleted_at.is_(None),
        )
    ).all()
    if not photos:
        raise NotFoundError("No matching photos were found")

    for photo in photos:
        if trip_id is not None and trip_id != photo.trip_id:
            db.execute(delete(EventMedia).where(EventMedia.photo_id == photo.id))
            photo.trip_id = trip_id
        if place_id is not None:
            photo.place_id = place_id
        if is_favorite is not None:
            photo.is_favorite = is_favorite
    db.commit()
    return len(photos)


def delete_photo(db: Session, photo: Photo) -> None:
    photo.deleted_at = datetime.now(timezone.utc)
    db.execute(delete(EventMedia).where(EventMedia.photo_id == photo.id))
    for trip in db.scalars(select(Trip).where(Trip.cover_photo_id == photo.id)).all():
        trip.cover_photo_id = None
    db.commit()


def photo_file(db: Session, user_id: UUID, photo_id: UUID, size: str) -> tuple[Path, str, str]:
    photo = PhotoRepository.get(db, photo_id, user_id)
    if size == "original":
        relative_path, media_type = photo.file_path, photo.mime_type
    elif size == "preview":
        relative_path, media_type = photo.preview_path or photo.file_path, "image/jpeg"
    else:
        relative_path, media_type = (
            photo.thumb_path or photo.preview_path or photo.file_path,
            "image/jpeg",
        )
    if not relative_path:
        raise NotFoundError("Photo file not found")
    path = storage.resolve(relative_path)
    if not path.is_file():
        raise NotFoundError("Photo file not found")
    return path, media_type, photo.original_filename


def storage_usage(db: Session, user_id: UUID) -> int:
    return int(
        db.scalar(
            select(func.coalesce(func.sum(Photo.file_size), 0)).where(
                Photo.user_id == user_id, Photo.deleted_at.is_(None)
            )
        )
        or 0
    )
