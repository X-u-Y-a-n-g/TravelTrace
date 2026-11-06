"""Trip ↔ place visit endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.place import TripPlaceCreate, TripPlaceOut, TripPlaceUpdate
from app.services import place_service, trip_service

router = APIRouter(prefix="/trips", tags=["places"])


@router.get(
    "/{trip_id}/places", response_model=list[TripPlaceOut], summary="Places visited on a trip"
)
def list_trip_places(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TripPlaceOut]:
    return place_service.list_trip_places(db, trip_id, user.id)


@router.post(
    "/{trip_id}/places",
    response_model=TripPlaceOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a place to a trip",
)
def attach_place(
    trip_id: UUID,
    payload: TripPlaceCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TripPlaceOut:
    trip = trip_service.get_trip(db, trip_id, user.id)
    visit = place_service.attach_place(db, trip, payload)
    return next(
        item for item in place_service.list_trip_places(db, trip.id, user.id) if item.id == visit.id
    )


@router.patch(
    "/{trip_id}/places/{visit_id}",
    response_model=TripPlaceOut,
    summary="Update a trip visit",
)
def update_place_visit(
    trip_id: UUID,
    visit_id: UUID,
    payload: TripPlaceUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TripPlaceOut:
    trip = trip_service.get_trip(db, trip_id, user.id)
    visit = place_service.get_visit(db, trip, visit_id)
    place_service.update_trip_place(db, visit, payload)
    return next(
        item for item in place_service.list_trip_places(db, trip.id, user.id) if item.id == visit.id
    )


@router.delete(
    "/{trip_id}/places/{visit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a place from a trip",
)
def detach_place(
    trip_id: UUID,
    visit_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    trip = trip_service.get_trip(db, trip_id, user.id)
    visit = place_service.get_visit(db, trip, visit_id)
    place_service.detach_place(db, visit)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
