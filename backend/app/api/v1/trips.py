"""Trip CRUD and export endpoints."""

from __future__ import annotations

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask

from app.api.deps import Pagination, get_current_user, pagination
from app.db.session import get_db
from app.models import User
from app.schemas.common import Page
from app.schemas.trip import TripCreate, TripDetailOut, TripOut, TripUpdate
from app.services import export_service, trip_service

router = APIRouter(prefix="/trips", tags=["trips"])


def _delete_file(path: Path) -> None:
    path.unlink(missing_ok=True)


@router.get("", response_model=Page[TripOut], summary="List trips")
def list_trips(
    page: Pagination = Depends(pagination),
    q: str | None = Query(default=None, max_length=200),
    year: int | None = Query(default=None, ge=1900, le=2200),
    visibility: str | None = Query(default=None),
    sort: str = Query(default="start_date_desc"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Page:
    return trip_service.list_trips(
        db,
        user.id,
        page=page.page,
        size=page.size,
        query=q,
        year=year,
        visibility=visibility,
        sort=sort,
    )


@router.post(
    "", response_model=TripDetailOut, status_code=status.HTTP_201_CREATED, summary="Create a trip"
)
def create_trip(
    payload: TripCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TripDetailOut:
    trip = trip_service.create_trip(db, user.id, payload)
    return trip_service.get_trip_detail(db, trip.id, user.id)


@router.get("/{trip_id}", response_model=TripDetailOut, summary="Trip detail")
def get_trip(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TripDetailOut:
    return trip_service.get_trip_detail(db, trip_id, user.id)


@router.patch("/{trip_id}", response_model=TripDetailOut, summary="Update a trip")
def update_trip(
    trip_id: UUID,
    payload: TripUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TripDetailOut:
    trip = trip_service.get_trip(db, trip_id, user.id)
    trip_service.update_trip(db, trip, payload)
    return trip_service.get_trip_detail(db, trip.id, user.id)


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a trip")
def delete_trip(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    trip = trip_service.get_trip(db, trip_id, user.id)
    trip_service.delete_trip(db, trip)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{trip_id}/restore", response_model=TripOut, summary="Restore a deleted trip")
def restore_trip(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TripOut:
    trip_service.restore_trip(db, trip_id, user.id)
    return trip_service.trip_summary(db, trip_id, user.id)


@router.get("/{trip_id}/export", summary="Export a trip as a portable ZIP")
def export_trip(
    trip_id: UUID,
    include_originals: bool = Query(default=True),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    archive = export_service.build_export(db, trip_id, user.id, include_originals=include_originals)
    return FileResponse(
        path=archive,
        media_type="application/zip",
        filename=archive.name,
        background=BackgroundTask(_delete_file, archive),
    )
