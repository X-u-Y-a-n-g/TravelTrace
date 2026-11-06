"""Shared pytest fixtures.

Environment variables are configured before the application package is imported
so settings point at an isolated temporary database and storage directory.
"""

from __future__ import annotations

import io
import os
import shutil
import tempfile
import uuid
from datetime import datetime
from types import SimpleNamespace

_TMP_ROOT = tempfile.mkdtemp(prefix="traveltrace-tests-")
os.environ.update(
    {
        "TRAVELTRACE_ENVIRONMENT": "test",
        "TRAVELTRACE_DATABASE_URL": f"sqlite:///{_TMP_ROOT}/test.db",
        "TRAVELTRACE_STORAGE_DIR": f"{_TMP_ROOT}/uploads",
        "TRAVELTRACE_TASK_BACKEND": "inline",
        "TRAVELTRACE_SECRET_KEY": "test-secret-key-not-for-production",
        "TRAVELTRACE_GEOCODING_PROVIDER": "none",
        "TRAVELTRACE_EXIFTOOL_ENABLED": "false",
    }
)

import app.models
import pytest
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.main import app
from fastapi.testclient import TestClient
from PIL import ExifTags, Image
from PIL.TiffImagePlugin import IFDRational

DEFAULT_PASSWORD = "supersecret123"


@pytest.fixture(autouse=True)
def clean_state():
    yield
    with engine.begin() as connection:
        for table in reversed(Base.metadata.sorted_tables):
            connection.execute(table.delete())
    shutil.rmtree(settings.storage_dir, ignore_errors=True)
    settings.storage_dir.mkdir(parents=True, exist_ok=True)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def register_user(
    test_client: TestClient,
    *,
    username: str | None = None,
    email: str | None = None,
    password: str = DEFAULT_PASSWORD,
    display_name: str | None = None,
) -> dict:
    suffix = uuid.uuid4().hex[:8]
    payload = {
        "username": username or f"traveller{suffix}",
        "email": email or f"traveller{suffix}@example.com",
        "password": password,
    }
    if display_name:
        payload["display_name"] = display_name
    response = test_client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def auth(client: TestClient) -> SimpleNamespace:
    data = register_user(client, display_name="Test Traveller")
    return SimpleNamespace(
        user=data["user"],
        token=data["access_token"],
        headers={"Authorization": f"Bearer {data['access_token']}"},
    )


@pytest.fixture
def other_auth(client: TestClient) -> SimpleNamespace:
    data = register_user(client)
    return SimpleNamespace(
        user=data["user"],
        token=data["access_token"],
        headers={"Authorization": f"Bearer {data['access_token']}"},
    )


@pytest.fixture
def create_trip(client: TestClient):
    def _create(headers: dict, **overrides) -> dict:
        payload = {
            "title": "Kyoto in Autumn",
            "description": "Temples, food and long walks.",
            "start_date": "2026-10-01",
            "end_date": "2026-10-05",
            "visibility": "private",
        }
        payload.update(overrides)
        response = client.post("/api/v1/trips", json=payload, headers=headers)
        assert response.status_code == 201, response.text
        return response.json()

    return _create


@pytest.fixture
def make_image():
    """Create a JPEG (with optional EXIF GPS/time) as an in-memory upload."""

    def _make(
        *,
        taken_at: datetime | str | None = datetime(2026, 10, 1, 10, 30, 0),
        latitude: float | None = 34.693722,
        longitude: float | None = 135.5,
        offset: str | None = "+09:00",
        size: tuple[int, int] = (960, 640),
        colour: tuple[int, int, int] = (45, 85, 65),
        make: str = "Canon",
        model: str = "EOS R6",
        lens: str = "RF 24-70mm F2.8 L IS USM",
    ) -> io.BytesIO:
        buffer = io.BytesIO()
        image = Image.new("RGB", size, colour)
        exif = Image.Exif()
        exif[0x010F] = make
        exif[0x0110] = model
        exif_ifd = {42036: lens}
        if taken_at is not None:
            moment = (
                taken_at if isinstance(taken_at, datetime) else datetime.fromisoformat(taken_at)
            )
            exif_ifd[36867] = moment.strftime("%Y:%m:%d %H:%M:%S")
            if offset:
                exif_ifd[36881] = offset
        exif[ExifTags.IFD.Exif] = exif_ifd
        if latitude is not None and longitude is not None:
            lat_deg = int(abs(latitude))
            lat_min = int((abs(latitude) - lat_deg) * 60)
            lat_sec = (abs(latitude) - lat_deg - lat_min / 60) * 3600
            lon_deg = int(abs(longitude))
            lon_min = int((abs(longitude) - lon_deg) * 60)
            lon_sec = (abs(longitude) - lon_deg - lon_min / 60) * 3600
            exif[ExifTags.IFD.GPSInfo] = {
                1: "N" if latitude >= 0 else "S",
                2: (
                    IFDRational(lat_deg),
                    IFDRational(lat_min),
                    IFDRational(round(lat_sec * 100), 100),
                ),
                3: "E" if longitude >= 0 else "W",
                4: (
                    IFDRational(lon_deg),
                    IFDRational(lon_min),
                    IFDRational(round(lon_sec * 100), 100),
                ),
            }
        image.save(buffer, "JPEG", exif=exif, quality=88)
        buffer.seek(0)
        buffer.name = "photo.jpg"
        return buffer

    return _make


@pytest.fixture
def upload_photo(client: TestClient, make_image):
    def _upload(
        headers: dict,
        *,
        trip_id: str | None = None,
        place_id: str | None = None,
        filename: str = "kyoto.jpg",
        **image_kwargs,
    ) -> tuple[dict, dict]:
        data = {}
        if trip_id:
            data["trip_id"] = trip_id
        if place_id:
            data["place_id"] = place_id
        response = client.post(
            "/api/v1/photos/upload",
            files={"files": (filename, make_image(**image_kwargs), "image/jpeg")},
            data=data,
            headers=headers,
        )
        assert response.status_code == 202, response.text
        task = client.get(f"/api/v1/imports/{response.json()['task_id']}", headers=headers).json()
        return response.json(), task

    return _upload


@pytest.fixture
def create_place(client: TestClient):
    def _create(headers: dict, **overrides) -> dict:
        payload = {
            "name": "Kiyomizu-dera",
            "category": "attraction",
            "city": "Kyoto",
            "region": "Kyoto",
            "country": "Japan",
            "country_code": "JP",
            "latitude": 34.994856,
            "longitude": 135.785046,
            "address": "1-294 Kiyomizu, Higashiyama Ward, Kyoto",
        }
        payload.update(overrides)
        response = client.post("/api/v1/places", json=payload, headers=headers)
        assert response.status_code == 201, response.text
        return response.json()

    return _create


@pytest.fixture
def attach_place(client: TestClient):
    def _attach(headers: dict, trip_id: str, place_id: str, **overrides) -> dict:
        payload = {"place_id": place_id}
        payload.update(overrides)
        response = client.post(f"/api/v1/trips/{trip_id}/places", json=payload, headers=headers)
        assert response.status_code == 201, response.text
        return response.json()

    return _attach
