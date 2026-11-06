"""API v1 router aggregation."""

from fastapi import APIRouter

from app.api.v1 import (
    auth,
    dashboard,
    health,
    imports,
    map,
    photos,
    places,
    timeline,
    trip_places,
    trips,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(health.router)
api_router.include_router(trips.router)
api_router.include_router(timeline.router)
api_router.include_router(trip_places.router)
api_router.include_router(places.router)
api_router.include_router(photos.router)
api_router.include_router(imports.router)
api_router.include_router(map.router)
api_router.include_router(dashboard.router)
