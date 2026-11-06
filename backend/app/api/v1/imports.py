"""Import task endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import Pagination, get_current_user, pagination
from app.db.session import get_db
from app.models import User
from app.schemas.common import Page
from app.schemas.import_task import ImportTaskOut
from app.services import import_service, photo_service

router = APIRouter(prefix="/imports", tags=["imports"])


@router.post(
    "",
    response_model=ImportTaskOut,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Create a photo import task",
)
def create_import(
    files: list[UploadFile] = File(...),
    trip_id: UUID | None = Form(default=None),
    place_id: UUID | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ImportTaskOut:
    task = photo_service.create_import_task(db, user.id, files, trip_id=trip_id, place_id=place_id)
    db.refresh(task)
    return ImportTaskOut.model_validate(task)


@router.get("", response_model=Page[ImportTaskOut], summary="List import tasks")
def list_imports(
    page: Pagination = Depends(pagination),
    status_filter: str | None = Query(default=None, alias="status"),
    trip_id: UUID | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Page:
    return import_service.list_tasks(
        db,
        user.id,
        page=page.page,
        size=page.size,
        status=status_filter,
        trip_id=trip_id,
    )


@router.get("/{task_id}", response_model=ImportTaskOut, summary="Import task status")
def get_import(
    task_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ImportTaskOut:
    task = import_service.get_task(db, task_id, user.id)
    db.refresh(task)
    return ImportTaskOut.model_validate(task)


@router.post("/{task_id}/cancel", response_model=ImportTaskOut, summary="Cancel an import task")
def cancel_import(
    task_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ImportTaskOut:
    task = import_service.get_task(db, task_id, user.id)
    task = import_service.cancel_task(db, task)
    return ImportTaskOut.model_validate(task)
