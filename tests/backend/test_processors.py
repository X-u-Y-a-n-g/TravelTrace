"""Unit tests for processors, geo helpers and security primitives."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pytest
from PIL import Image

from app.core.errors import AppError
from app.core.geo import bounding_box, haversine_m, parse_bbox
from app.core.security import (
    hash_password,
    validate_password,
    verify_password,
)
from app.processors.clustering import PhotoPoint, cluster_photos
from app.processors.exif_processor import inspect_image
from app.processors.thumbnails import generate_derivatives
from app.services.storage import Storage, safe_filename


def _write_image(tmp_path: Path, buffer) -> Path:
    path = tmp_path / "photo.jpg"
    path.write_bytes(buffer.getvalue())
    return path


def test_haversine_distance():
    tokyo = (35.6762, 139.6503)
    osaka = (34.6937, 135.5023)
    distance_km = haversine_m(*tokyo, *osaka) / 1000
    assert 380 < distance_km < 420

    assert haversine_m(34.0, 135.0, 34.0, 135.0) == pytest.approx(0, abs=1e-6)


def test_bounding_box_contains_origin():
    min_lat, max_lat, min_lon, max_lon = bounding_box(34.6937, 135.5, 500)
    assert min_lat < 34.6937 < max_lat
    assert min_lon < 135.5 < max_lon


def test_parse_bbox():
    assert parse_bbox("135.0,34.0,136.0,35.0") == (135.0, 34.0, 136.0, 35.0)
    assert parse_bbox(None) is None
    for invalid in ("1,2,3", "a,b,c,d", "136,34,135,35", "200,0,201,1"):
        with pytest.raises(ValueError):
            parse_bbox(invalid)


def test_inspect_image_extracts_exif(tmp_path, make_image):
    path = _write_image(tmp_path, make_image())
    info = inspect_image(path)
    assert info.format == "JPEG"
    assert info.mime_type == "image/jpeg"
    assert info.extension == "jpg"
    assert (info.width, info.height) == (960, 640)
    assert info.taken_at == datetime(2026, 10, 1, 10, 30)
    assert info.taken_at_offset_minutes == 540
    assert info.latitude == pytest.approx(34.6937, abs=1e-4)
    assert info.longitude == pytest.approx(135.5, abs=1e-4)
    assert info.camera_make == "Canon"
    assert info.camera_model == "EOS R6"
    assert info.lens == "RF 24-70mm F2.8 L IS USM"
    assert info.metadata["taken_at_original"] == "2026:10:01 10:30:00"
    assert info.metadata["offset_time_original"] == "+09:00"


def test_inspect_image_without_exif(tmp_path, make_image):
    path = _write_image(tmp_path, make_image(taken_at=None, latitude=None, longitude=None))
    info = inspect_image(path)
    assert info.taken_at is None
    assert info.latitude is None
    assert info.longitude is None


def test_inspect_image_rejects_non_images(tmp_path):
    path = tmp_path / "notes.jpg"
    path.write_bytes(b"not an image at all")
    with pytest.raises(AppError) as error:
        inspect_image(path)
    assert error.value.status_code == 415


def test_derivatives_are_smaller_and_strip_exif(tmp_path, make_image):
    source = _write_image(tmp_path, make_image())
    preview = tmp_path / "preview.jpg"
    thumb = tmp_path / "thumb.jpg"
    width, height = generate_derivatives(source, preview, thumb, preview_px=480, thumb_px=160)
    assert (width, height) == (960, 640)
    assert preview.exists() and thumb.exists()
    assert preview.stat().st_size < source.stat().st_size

    with Image.open(thumb) as image:
        assert max(image.size) <= 160
        assert len(image.getexif()) == 0

    with Image.open(preview) as image:
        gps = image.getexif().get_ifd(34853)
        assert not gps


def test_clustering_splits_on_time_and_distance():
    def point(minute, lat=34.69, lon=135.5, place=None):
        return PhotoPoint(
            id=__import__("uuid").uuid4(),
            taken_at=datetime(2026, 10, 1, 10, minute),
            latitude=lat,
            longitude=lon,
            place_id=place,
        )

    nearby = cluster_photos([point(0), point(20)], max_gap_minutes=180)
    assert len(nearby) == 1
    assert len(nearby[0].photos) == 2

    far_in_time = cluster_photos([point(0), point(10)], max_gap_minutes=0.1)
    assert len(far_in_time) == 2

    far_in_space = cluster_photos(
        [point(0), point(1, lat=34.75)], max_gap_minutes=180, max_distance_km=1
    )
    assert len(far_in_space) == 2


def test_clustering_splits_when_place_changes():
    place_a = __import__("uuid").uuid4()
    place_b = __import__("uuid").uuid4()

    def point(minute, place):
        return PhotoPoint(
            id=__import__("uuid").uuid4(),
            taken_at=datetime(2026, 10, 1, 10, minute),
            latitude=34.69,
            longitude=135.5,
            place_id=place,
        )

    clusters = cluster_photos([point(0, place_a), point(45, place_b)], max_gap_minutes=180)
    assert len(clusters) == 2

    same_place = cluster_photos([point(0, place_a), point(45, place_a)], max_gap_minutes=180)
    assert len(same_place) == 1


def test_clustering_splits_across_days():
    first = PhotoPoint(
        id=__import__("uuid").uuid4(),
        taken_at=datetime(2026, 10, 1, 23, 50),
        latitude=34.69,
        longitude=135.5,
    )
    second = PhotoPoint(
        id=__import__("uuid").uuid4(),
        taken_at=datetime(2026, 10, 2, 0, 10),
        latitude=34.69,
        longitude=135.5,
    )
    assert len(cluster_photos([first, second], max_gap_minutes=180)) == 2


def test_storage_blocks_path_traversal(tmp_path):
    store = Storage(tmp_path / "storage")
    with pytest.raises(AppError):
        store.resolve("../escape.txt")
    with pytest.raises(AppError):
        store.resolve("/etc/passwd")


def test_safe_filename():
    assert safe_filename("../../etc/passwd") == "etc_passwd"
    assert safe_filename("京都の写真.jpg") == "jpg"
    assert safe_filename("") == "upload"
    assert safe_filename("IMG_0001.JPG") == "IMG_0001.JPG"


def test_password_hashing():
    digest = hash_password("correct horse battery")
    assert verify_password("correct horse battery", digest)
    assert not verify_password("wrong", digest)
    assert not verify_password("wrong", "not-a-hash")


def test_password_policy():
    with pytest.raises(ValueError):
        validate_password("short")
    with pytest.raises(ValueError):
        validate_password("a" * 73)
