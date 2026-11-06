"""Pluggable reverse geocoding.

The default provider is disabled: TravelTrace never sends coordinates to a third
party unless the operator explicitly configures one. This keeps the local-first
privacy promise honest.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Protocol

import httpx

from app.core.config import settings
from app.core.errors import ServiceUnavailableError
from app.schemas.place import GeocodeResult

logger = logging.getLogger(__name__)


class GeocodingProvider(Protocol):
    name: str

    def reverse(self, latitude: float, longitude: float) -> GeocodeResult: ...


class DisabledProvider:
    name = "none"

    def reverse(self, latitude: float, longitude: float) -> GeocodeResult:
        raise ServiceUnavailableError(
            "Reverse geocoding is disabled. Enable it with "
            "TRAVELTRACE_GEOCODING_PROVIDER=nominatim.",
            code="geocoding_disabled",
        )


class NominatimProvider:
    name = "nominatim"

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._last_request = 0.0

    def _throttle(self) -> None:
        interval = max(settings.geocoding_min_interval_seconds, 0.0)
        with self._lock:
            elapsed = time.monotonic() - self._last_request
            if elapsed < interval:
                time.sleep(interval - elapsed)
            self._last_request = time.monotonic()

    def reverse(self, latitude: float, longitude: float) -> GeocodeResult:
        self._throttle()
        url = f"{settings.geocoding_url.rstrip('/')}/reverse"
        params = {
            "format": "jsonv2",
            "lat": f"{latitude:.7f}",
            "lon": f"{longitude:.7f}",
            "zoom": "18",
            "addressdetails": "1",
            "accept-language": "en",
        }
        headers = {"User-Agent": settings.geocoding_user_agent, "Accept": "application/json"}
        try:
            response = httpx.get(
                url, params=params, headers=headers, timeout=settings.geocoding_timeout_seconds
            )
            response.raise_for_status()
            data = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("Reverse geocoding failed: %s", exc)
            raise ServiceUnavailableError("The geocoding service is unavailable") from exc

        address = data.get("address") or {}
        name = next(
            (
                address[key]
                for key in (
                    "attraction",
                    "tourism",
                    "amenity",
                    "shop",
                    "leisure",
                    "natural",
                    "building",
                    "road",
                )
                if address.get(key)
            ),
            data.get("name"),
        )
        city = (
            address.get("city")
            or address.get("town")
            or address.get("village")
            or address.get("municipality")
            or address.get("hamlet")
        )
        region = address.get("state") or address.get("region") or address.get("county")
        country_code = address.get("country_code")
        return GeocodeResult(
            provider=self.name,
            display_name=data.get("display_name"),
            name=name,
            address=data.get("display_name"),
            city=city,
            region=region,
            country=address.get("country"),
            country_code=country_code.upper() if country_code else None,
            latitude=float(data["lat"]) if data.get("lat") else latitude,
            longitude=float(data["lon"]) if data.get("lon") else longitude,
        )


_PROVIDER: GeocodingProvider | None = None
_PROVIDER_LOCK = threading.Lock()


def get_geocoding_provider() -> GeocodingProvider:
    global _PROVIDER
    if _PROVIDER is None:
        with _PROVIDER_LOCK:
            if _PROVIDER is None:
                if settings.geocoding_provider == "nominatim":
                    _PROVIDER = NominatimProvider()
                else:
                    _PROVIDER = DisabledProvider()
    return _PROVIDER


def reset_provider_cache() -> None:
    """Testing helper."""
    global _PROVIDER
    _PROVIDER = None
