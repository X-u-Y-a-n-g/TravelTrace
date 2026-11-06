"""Map endpoints."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.errors import BadRequestError
from app.core.geo import parse_bbox
from app.db.session import get_db
from app.models import User
from app.schemas.map import MapMarkersOut
from app.services import map_service

router = APIRouter(prefix="/map", tags=["map"])


def _parse_ids(raw: str | None, *, field: str) -> list[UUID]:
    if not raw:
        return []
    values: list[UUID] = []
    for chunk in raw.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        try:
            values.append(UUID(chunk))
        except ValueError as exc:
            raise BadRequestError(f"Invalid {field} value: {chunk}", code="invalid_query") from exc
    return values


@router.get("/markers", response_model=MapMarkersOut, summary="Map markers")
def markers(
    trip_id: UUID | None = Query(default=None),
    trip_ids: str | None = Query(default=None, description="Comma-separated trip IDs"),
    bbox: str | None = Query(default=None, description="minLon,minLat,maxLon,maxLat"),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    categories: str | None = Query(default=None, description="Comma-separated place categories"),
    limit: int = Query(default=2000, ge=1, le=5000),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MapMarkersOut:
    try:
        bounds = parse_bbox(bbox)
    except ValueError as exc:
        raise BadRequestError(str(exc), code="invalid_bbox") from exc

    ids = _parse_ids(trip_ids, field="trip_ids")
    if trip_id is not None and trip_id not in ids:
        ids.append(trip_id)
    category_list = (
        [value.strip() for value in categories.split(",") if value.strip()] if categories else None
    )

    return map_service.get_markers(
        db,
        user.id,
        trip_ids=ids or None,
        bbox=bounds,
        date_from=date_from,
        date_to=date_to,
        categories=category_list,
        limit=limit,
    )


@router.get("/routes", summary="Trip route geometries (GeoJSON)")
def routes(
    trip_id: UUID | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return map_service.get_routes(db, user.id, trip_id=trip_id)
