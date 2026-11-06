"""Place endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import Pagination, get_current_user, pagination
from app.core.errors import BadRequestError
from app.core.geo import parse_bbox
from app.db.session import get_db
from app.models import User
from app.models.enums import PlaceCategory
from app.repositories import PlaceRepository
from app.schemas.common import Page
from app.schemas.place import (
    GeocodeRequest,
    GeocodeResult,
    PlaceCreate,
    PlaceOut,
    PlaceUpdate,
)
from app.services import place_service

router = APIRouter(prefix="/places", tags=["places"])


@router.get("/categories", response_model=list[str], summary="Available place categories")
def categories() -> list[str]:
    return [category.value for category in PlaceCategory]


@router.get("", response_model=Page[PlaceOut], summary="List places")
def list_places(
    page: Pagination = Depends(pagination),
    trip_id: UUID | None = Query(default=None),
    category: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=200),
    bbox: str | None = Query(default=None, description="minLon,minLat,maxLon,maxLat"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Page:
    try:
        bounds = parse_bbox(bbox)
    except ValueError as exc:
        raise BadRequestError(str(exc), code="invalid_bbox") from exc
    return place_service.list_places(
        db,
        user.id,
        page=page.page,
        size=page.size,
        trip_id=trip_id,
        category=category,
        query=q,
        bbox=bounds,
    )


@router.post(
    "", response_model=PlaceOut, status_code=status.HTTP_201_CREATED, summary="Create a place"
)
def create_place(
    payload: PlaceCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlaceOut:
    place = place_service.create_place(db, user.id, payload)
    return place_service.get_place(db, place.id, user.id)


@router.post("/geocode", response_model=GeocodeResult, summary="Reverse geocode coordinates")
def geocode(payload: GeocodeRequest, _: User = Depends(get_current_user)) -> GeocodeResult:
    return place_service.reverse_geocode(payload.latitude, payload.longitude)


@router.get("/{place_id}", response_model=PlaceOut, summary="Place detail")
def get_place(
    place_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlaceOut:
    return place_service.get_place(db, place_id, user.id)


@router.patch("/{place_id}", response_model=PlaceOut, summary="Update a place")
def update_place(
    place_id: UUID,
    payload: PlaceUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlaceOut:
    place = PlaceRepository.get(db, place_id, user.id)
    entity = place_service.update_place(db, place, payload)
    return place_service.get_place(db, entity.id, user.id)


@router.delete("/{place_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a place")
def delete_place(
    place_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    place = PlaceRepository.get(db, place_id, user.id)
    place_service.delete_place(db, place)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
