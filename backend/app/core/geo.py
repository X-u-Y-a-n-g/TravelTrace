"""Geospatial helpers.

Coordinates are stored twice on purpose:

* ``latitude`` / ``longitude`` as plain doubles so every database can filter and
  sort by them portably;
* ``location`` as a PostGIS ``GEOGRAPHY(POINT, 4326)`` on PostgreSQL for spatial
  queries and indexing (SQLite stores the WKT string for local development).
"""

from __future__ import annotations

import math
from typing import Any

from geoalchemy2 import Geography
from geoalchemy2.elements import WKTElement
from sqlalchemy import Text, event
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.types import TypeDecorator

EARTH_RADIUS_M = 6_371_008.8


def clamp_coordinates(
    latitude: float | None, longitude: float | None
) -> tuple[float, float] | None:
    if latitude is None or longitude is None:
        return None
    if not (-90.0 <= latitude <= 90.0 and -180.0 <= longitude <= 180.0):
        raise ValueError("Coordinates must be within latitude [-90, 90] and longitude [-180, 180]")
    return float(latitude), float(longitude)


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points in metres."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(a)))


def bounding_box(lat: float, lon: float, radius_m: float) -> tuple[float, float, float, float]:
    """Return ``(min_lat, max_lat, min_lon, max_lon)`` around a point."""
    dlat = radius_m / EARTH_RADIUS_M * 180.0 / math.pi
    cos_lat = max(math.cos(math.radians(lat)), 1e-6)
    dlon = radius_m / (EARTH_RADIUS_M * cos_lat) * 180.0 / math.pi
    return lat - dlat, lat + dlat, lon - dlon, lon + dlon


def parse_bbox(raw: str | None) -> tuple[float, float, float, float] | None:
    """Parse ``min_lon,min_lat,max_lon,max_lat`` (GeoJSON order)."""
    if not raw:
        return None
    parts = raw.split(",")
    if len(parts) != 4:
        raise ValueError("bbox must contain four comma-separated numbers")
    try:
        min_lon, min_lat, max_lon, max_lat = (float(part) for part in parts)
    except ValueError as exc:
        raise ValueError("bbox values must be numbers") from exc
    if not (-180 <= min_lon <= 180 and -180 <= max_lon <= 180):
        raise ValueError("bbox longitude must be within [-180, 180]")
    if not (-90 <= min_lat <= 90 and -90 <= max_lat <= 90):
        raise ValueError("bbox latitude must be within [-90, 90]")
    if min_lon > max_lon or min_lat > max_lat:
        raise ValueError("bbox minimums must not exceed maximums")
    return min_lon, min_lat, max_lon, max_lat


class GeoPoint(TypeDecorator):
    """Portable point type: PostGIS geography on PostgreSQL, WKT text elsewhere."""

    impl = Text
    cache_ok = True
    # GeoAlchemy2's DDL hooks inspect these attributes on the column type. The
    # spatial index is created explicitly in the migration, not automatically.
    spatial_index = False

    def load_dialect_impl(self, dialect: Dialect) -> Any:
        if dialect.name == "postgresql":
            return dialect.type_descriptor(
                Geography(geometry_type="POINT", srid=4326, spatial_index=False)
            )
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        if value is None:
            return None
        try:
            lon, lat = value
        except (TypeError, ValueError) as exc:
            raise ValueError("GeoPoint value must be a (longitude, latitude) pair") from exc
        if dialect.name == "postgresql":
            return WKTElement(f"POINT({float(lon)} {float(lat)})", srid=4326, extended=False)
        return f"POINT({float(lon)} {float(lat)})"

    def process_result_value(self, value: Any, dialect: Dialect) -> Any:
        # The latitude/longitude columns remain the source of truth for reads.
        return value


def sync_location(_mapper: Any, _connection: Any, target: Any) -> None:
    """Mapper hook that mirrors lat/lon into the geography column."""
    lat = getattr(target, "latitude", None)
    lon = getattr(target, "longitude", None)
    if lat is None or lon is None:
        target.location = None
        return
    target.location = (float(lon), float(lat))


def register_location_sync(*classes: type) -> None:
    for cls in classes:
        event.listen(cls, "before_insert", sync_location)
        event.listen(cls, "before_update", sync_location)
