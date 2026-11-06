"""Timeline endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.timeline import (
    EventCreate,
    EventOut,
    EventPhotoAttach,
    EventUpdate,
    GenerateTimelineRequest,
    TimelineGenerateResult,
    TimelineOut,
)
from app.services import timeline_service

router = APIRouter(prefix="/trips", tags=["timeline"])


@router.get("/{trip_id}/timeline", response_model=TimelineOut, summary="Trip timeline")
def get_timeline(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TimelineOut:
    return timeline_service.get_timeline(db, trip_id, user.id)


@router.post(
    "/{trip_id}/timeline/generate",
    response_model=TimelineGenerateResult,
    summary="Generate a draft timeline from photos",
)
def generate_timeline(
    trip_id: UUID,
    payload: GenerateTimelineRequest | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TimelineGenerateResult:
    return timeline_service.generate_timeline(
        db, trip_id, user.id, payload or GenerateTimelineRequest()
    )


@router.post(
    "/{trip_id}/events",
    response_model=EventOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a timeline event",
)
def create_event(
    trip_id: UUID,
    payload: EventCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventOut:
    return timeline_service.create_event(db, trip_id, user.id, payload)


@router.patch("/{trip_id}/events/{event_id}", response_model=EventOut, summary="Update an event")
def update_event(
    trip_id: UUID,
    event_id: UUID,
    payload: EventUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventOut:
    event = timeline_service.get_event(db, trip_id, event_id, user.id)
    return timeline_service.update_event(db, event, payload)


@router.delete(
    "/{trip_id}/events/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an event",
)
def delete_event(
    trip_id: UUID,
    event_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    event = timeline_service.get_event(db, trip_id, event_id, user.id)
    timeline_service.delete_event(db, event)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{trip_id}/events/{event_id}/photos",
    response_model=EventOut,
    summary="Attach photos to an event",
)
def attach_photos(
    trip_id: UUID,
    event_id: UUID,
    payload: EventPhotoAttach,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventOut:
    event = timeline_service.get_event(db, trip_id, event_id, user.id)
    return timeline_service.attach_photos(db, event, payload.photo_ids, user.id)


@router.delete(
    "/{trip_id}/events/{event_id}/photos/{photo_id}",
    response_model=EventOut,
    summary="Detach a photo from an event",
)
def detach_photo(
    trip_id: UUID,
    event_id: UUID,
    photo_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventOut:
    event = timeline_service.get_event(db, trip_id, event_id, user.id)
    return timeline_service.detach_photo(db, event, photo_id)
