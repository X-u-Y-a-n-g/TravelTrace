"""Preview and thumbnail generation with Pillow.

Derived images never carry EXIF metadata, which keeps GPS coordinates out of the
smaller files that are most likely to be shared or cached.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps

from app.core.config import settings


def _flatten_for_jpeg(image: Image.Image) -> Image.Image:
    if image.mode in {"RGBA", "LA", "P"}:
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, (255, 255, 255))
        background.paste(rgba, mask=rgba.split()[-1])
        return background
    if image.mode != "RGB":
        return image.convert("RGB")
    return image


def generate_derivatives(
    source: Path,
    preview_path: Path,
    thumb_path: Path,
    *,
    preview_px: int | None = None,
    thumb_px: int | None = None,
) -> tuple[int, int]:
    """Write a preview and thumbnail and return the oriented image dimensions."""
    preview_px = preview_px or settings.preview_px
    thumb_px = thumb_px or settings.thumbnail_px
    preview_path.parent.mkdir(parents=True, exist_ok=True)
    thumb_path.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(source) as image:
        oriented = ImageOps.exif_transpose(image)
        width, height = oriented.size
        for target, destination, quality in (
            (preview_px, preview_path, settings.preview_quality),
            (thumb_px, thumb_path, settings.thumbnail_quality),
        ):
            copy = oriented.copy()
            copy.thumbnail((target, target), Image.Resampling.LANCZOS)
            copy = _flatten_for_jpeg(copy)
            copy.save(destination, "JPEG", quality=quality, optimize=True, progressive=True)
            copy.close()
    return width, height
