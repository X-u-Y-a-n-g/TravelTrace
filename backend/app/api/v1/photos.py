"""Photo library and upload endpoints."""

from __future__ import annotations

from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import Pagination, get_current_user, pagination
from app.db.session import get_db
from app.models import User
from app.repositories import PhotoRepository
from app.schemas.common import Page
from app.schemas.photo import (
    PhotoBulkUpdate,
    PhotoOut,
    PhotoUpdate,
    PhotoUploadResult,
)
from app.services import photo_service

router = APIRouter(prefix="/photos", tags=["photos"])


@router.post(
    "/upload",
    response_model=PhotoUploadResult,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload photos",
)
def upload_photos(
    files: list[UploadFile] = File(..., description="JPEG, PNG or WebP images"),
    trip_id: UUID | None = Form(default=None),
    place_id: UUID | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PhotoUploadResult:
    task = photo_service.create_import_task(db, user.id, files, trip_id=trip_id, place_id=place_id)
    return PhotoUploadResult(task_id=task.id, uploaded_files=len(files))


@router.post("/bulk", summary="Bulk update photos")
def bulk_update(
    payload: PhotoBulkUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, int]:
    updated = photo_service.bulk_update(
        db,
        user.id,
        payload.photo_ids,
        trip_id=payload.trip_id,
        place_id=payload.place_id,
        is_favorite=payload.is_favorite,
    )
    return {"updated": updated}


@router.get("", response_model=Page[PhotoOut], summary="List photos")
def list_photos(
    page: Pagination = Depends(pagination),
    trip_id: UUID | None = Query(default=None),
    place_id: UUID | None = Query(default=None),
    unsorted: bool = Query(default=False),
    has_gps: bool | None = Query(default=None),
    favorite: bool | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    q: str | None = Query(default=None, max_length=200),
    camera: str | None = Query(default=None, max_length=120),
    sort: str = Query(default="taken_at_desc"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Page:
    return photo_service.list_photos(
        db,
        user.id,
        page=page.page,
        size=page.size,
        trip_id=trip_id,
        place_id=place_id,
        unsorted=unsorted,
        has_gps=has_gps,
        is_favorite=favorite,
        date_from=date_from,
        date_to=date_to,
        query=q,
        camera=camera,
        sort=sort,
    )


@router.get("/{photo_id}", response_model=PhotoOut, summary="Photo detail")
def get_photo(
    photo_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PhotoOut:
    return photo_service.get_photo(db, photo_id, user.id)


@router.patch("/{photo_id}", response_model=PhotoOut, summary="Update a photo")
def update_photo(
    photo_id: UUID,
    payload: PhotoUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PhotoOut:
    photo = PhotoRepository.get(db, photo_id, user.id)
    photo_service.update_photo(db, photo, payload)
    return photo_service.get_photo(db, photo.id, user.id)


@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a photo")
def delete_photo(
    photo_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    photo = PhotoRepository.get(db, photo_id, user.id)
    photo_service.delete_photo(db, photo)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{photo_id}/file", summary="Photo file (thumbnail, preview or original)")
def photo_file(
    photo_id: UUID,
    size: Literal["thumb", "preview", "original"] = Query(default="thumb"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    path, media_type, _filename = photo_service.photo_file(db, user.id, photo_id, size)
    max_age = 86400 if size == "thumb" else 3600
    return FileResponse(
        path=path,
        media_type=media_type,
        headers={
            "Cache-Control": f"private, max-age={max_age}",
            "X-Content-Type-Options": "nosniff",
        },
    )
