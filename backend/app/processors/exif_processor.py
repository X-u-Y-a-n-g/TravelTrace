"""EXIF and image metadata extraction.

Uses Pillow as the always-available baseline and optionally enriches the result
with exiftool when the binary is installed (recommended for HEIC and exotic
camera metadata, though HEIC is not accepted for upload in v0.1).
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from PIL import ExifTags, Image, UnidentifiedImageError

from app.core.config import settings
from app.core.errors import UnsupportedMediaError

logger = logging.getLogger(__name__)

SUPPORTED_FORMATS: dict[str, tuple[str, str]] = {
    "JPEG": ("image/jpeg", "jpg"),
    "PNG": ("image/png", "png"),
    "WEBP": ("image/webp", "webp"),
}

_TAG_MAKE = 271
_TAG_MODEL = 272
_TAG_ORIENTATION = 274
_TAG_DATETIME = 306
_TAG_SOFTWARE = 305
_TAG_DATETIME_ORIGINAL = 36867
_TAG_DATETIME_DIGITIZED = 36868
_TAG_OFFSET_TIME = 36880
_TAG_OFFSET_TIME_ORIGINAL = 36881
_TAG_OFFSET_TIME_DIGITIZED = 36882
_TAG_LENS_MODEL = 42036
_TAG_F_NUMBER = 33437
_TAG_EXPOSURE_TIME = 33434
_TAG_ISO = 34855
_TAG_FOCAL_LENGTH = 37386

_DATETIME_FORMATS = (
    "%Y:%m:%d %H:%M:%S",
    "%Y:%m:%d %H:%M:%S.%f",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S",
)


@dataclass
class ImageInfo:
    format: str
    mime_type: str
    extension: str
    width: int
    height: int
    taken_at: datetime | None = None
    taken_at_offset_minutes: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    gps_altitude: float | None = None
    camera_make: str | None = None
    camera_model: str | None = None
    lens: str | None = None
    orientation: int | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


def _text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        value = value.decode("utf-8", "ignore")
    value = str(value).strip().strip("\x00")
    return value or None


def _number(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def _rational_pair_to_degrees(value: Any, reference: str | None) -> float | None:
    try:
        degrees, minutes, seconds = (float(part) for part in value)
    except (TypeError, ValueError):
        return None
    result = degrees + minutes / 60.0 + seconds / 3600.0
    if reference and reference.strip().upper() in {"S", "W"}:
        result = -result
    return result


def _parse_offset(raw: Any) -> int | None:
    text = _text(raw)
    if not text:
        return None
    sign = -1 if text.startswith("-") else 1
    text = text.lstrip("+-")
    parts = text.split(":")
    try:
        hours = int(parts[0])
        minutes = int(parts[1]) if len(parts) > 1 else 0
    except (ValueError, IndexError):
        return None
    return sign * (hours * 60 + minutes)


def _parse_datetime(raw: Any) -> datetime | None:
    text = _text(raw)
    if not text:
        return None
    for fmt in _DATETIME_FORMATS:
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, bytes):
        return _text(value)
    if isinstance(value, (tuple, list)):
        return [_json_safe(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    try:
        return float(value)
    except (TypeError, ValueError):
        return str(value)


def _apply_pillow_exif(info: ImageInfo, exif) -> None:  # noqa: ANN001
    try:
        exif_ifd = exif.get_ifd(ExifTags.IFD.Exif) or {}
    except (KeyError, AttributeError, ValueError):
        exif_ifd = {}
    try:
        gps_ifd = exif.get_ifd(ExifTags.IFD.GPSInfo) or {}
    except (KeyError, AttributeError, ValueError):
        gps_ifd = {}

    info.camera_make = _text(exif.get(_TAG_MAKE))
    info.camera_model = _text(exif.get(_TAG_MODEL))
    info.lens = _text(exif_ifd.get(_TAG_LENS_MODEL))
    orientation = exif.get(_TAG_ORIENTATION)
    info.orientation = int(orientation) if isinstance(orientation, (int, float)) else None

    taken = (
        exif_ifd.get(_TAG_DATETIME_ORIGINAL)
        or exif_ifd.get(_TAG_DATETIME_DIGITIZED)
        or exif.get(_TAG_DATETIME)
    )
    info.taken_at = _parse_datetime(taken)
    info.taken_at_offset_minutes = (
        _parse_offset(exif_ifd.get(_TAG_OFFSET_TIME_ORIGINAL))
        or _parse_offset(exif_ifd.get(_TAG_OFFSET_TIME_DIGITIZED))
        or _parse_offset(exif_ifd.get(_TAG_OFFSET_TIME))
    )

    lat = _rational_pair_to_degrees(
        gps_ifd.get(2), _text(gps_ifd.get(1)) if gps_ifd.get(1) else None
    )
    lon = _rational_pair_to_degrees(
        gps_ifd.get(4), _text(gps_ifd.get(3)) if gps_ifd.get(3) else None
    )
    if lat is not None and lon is not None and not (abs(lat) < 1e-9 and abs(lon) < 1e-9):
        info.latitude = lat
        info.longitude = lon
        altitude = _number(gps_ifd.get(6))
        if altitude is not None:
            info.gps_altitude = -altitude if gps_ifd.get(5) == 1 else altitude

    info.metadata = {
        "taken_at_original": _text(taken),
        "offset_time_original": _text(exif_ifd.get(_TAG_OFFSET_TIME_ORIGINAL)),
        "make": info.camera_make,
        "model": info.camera_model,
        "lens": info.lens,
        "orientation": info.orientation,
        "software": _text(exif.get(_TAG_SOFTWARE)),
        "f_number": _number(exif_ifd.get(_TAG_F_NUMBER)),
        "exposure_time": _number(exif_ifd.get(_TAG_EXPOSURE_TIME)),
        "iso": _number(exif_ifd.get(_TAG_ISO)),
        "focal_length": _number(exif_ifd.get(_TAG_FOCAL_LENGTH)),
        "gps_altitude": info.gps_altitude,
    }
    info.metadata = {key: value for key, value in info.metadata.items() if value is not None}


def _merge_exiftool(info: ImageInfo, path: Path) -> None:
    binary = shutil.which("exiftool")
    if not binary:
        return
    try:
        completed = subprocess.run(  # noqa: S603 - fixed binary, no shell
            [binary, "-json", "-n", "-fast2", str(path)],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        logger.debug("exiftool failed for %s: %s", path, exc)
        return
    if completed.returncode != 0 or not completed.stdout.strip():
        return
    try:
        data = json.loads(completed.stdout)[0]
    except (ValueError, IndexError):
        return

    if info.taken_at is None:
        info.taken_at = _parse_datetime(data.get("DateTimeOriginal"))
        offset = _parse_offset(data.get("OffsetTimeOriginal"))
        if offset is not None:
            info.taken_at_offset_minutes = offset
    for field_name, key in (
        ("camera_make", "Make"),
        ("camera_model", "Model"),
        ("lens", "LensModel"),
    ):
        if getattr(info, field_name) is None and data.get(key):
            setattr(info, field_name, _text(data.get(key)))
    if info.latitude is None and data.get("GPSLatitude") is not None:
        lat = _number(data.get("GPSLatitude"))
        lon = _number(data.get("GPSLongitude"))
        if lat is not None and lon is not None:
            if _text(data.get("GPSLatitudeRef")) in {"S", "s"}:
                lat = -abs(lat)
            if _text(data.get("GPSLongitudeRef")) in {"W", "w"}:
                lon = -abs(lon)
            info.latitude, info.longitude = lat, lon

    interesting = {
        "exiftool": {
            key: _json_safe(data.get(key))
            for key in ("Make", "Model", "LensModel", "DateTimeOriginal", "OffsetTimeOriginal")
            if data.get(key) is not None
        }
    }
    info.metadata.update(interesting)


def inspect_image(path: Path) -> ImageInfo:
    """Validate an image and return everything TravelTrace needs about it."""
    try:
        with Image.open(path) as image:
            image_format = (image.format or "").upper()
            if image_format not in SUPPORTED_FORMATS:
                raise UnsupportedMediaError(
                    f"Unsupported image format: {image_format or 'unknown'}. "
                    "Upload JPEG, PNG or WebP images."
                )
            mime_type, extension = SUPPORTED_FORMATS[image_format]
            width, height = image.size
            info = ImageInfo(
                format=image_format,
                mime_type=mime_type,
                extension=extension,
                width=width,
                height=height,
            )
            try:
                exif = image.getexif()
            except (OSError, ValueError):
                exif = None
            if exif:
                _apply_pillow_exif(info, exif)
            image.verify()
    except UnidentifiedImageError as exc:
        raise UnsupportedMediaError("The file is not a valid image") from exc
    except Image.DecompressionBombError as exc:
        raise UnsupportedMediaError("Image dimensions are too large") from exc
    except (OSError, ValueError) as exc:
        raise UnsupportedMediaError("The image could not be read") from exc

    if settings.exiftool_enabled:
        _merge_exiftool(info, path)

    info.metadata["format"] = info.format
    info.metadata["width"] = width
    info.metadata["height"] = height
    return info
