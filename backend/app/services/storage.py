"""Local filesystem storage for originals and derived images.

Paths stored in the database are always POSIX-style and relative to the storage
root, so the data directory can be moved or mounted as a volume.
"""

from __future__ import annotations

import contextlib
import re
import shutil
import unicodedata
from pathlib import Path
from uuid import UUID

from app.core.config import settings
from app.core.errors import AppError

_SAFE_CHARS = re.compile(r"[^A-Za-z0-9._-]+")


def safe_filename(name: str) -> str:
    normalised = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    normalised = _SAFE_CHARS.sub("_", normalised).strip("._")
    return normalised[:120] or "upload"


class Storage:
    def __init__(self, root: Path | None = None) -> None:
        self.root = Path(root or settings.storage_dir).expanduser().resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    # --- path helpers ---------------------------------------------------
    def user_dir(self, user_id: UUID) -> Path:
        path = self.root / str(user_id)
        path.mkdir(parents=True, exist_ok=True)
        return path

    def incoming_dir(self, user_id: UUID, task_id: UUID) -> Path:
        path = self.user_dir(user_id) / "_incoming" / str(task_id)
        if path.exists():
            shutil.rmtree(path, ignore_errors=True)
        path.mkdir(parents=True, exist_ok=True)
        return path

    def final_path(self, user_id: UUID, photo_id: UUID, extension: str) -> Path:
        folder = self.user_dir(user_id) / str(photo_id)[:2]
        folder.mkdir(parents=True, exist_ok=True)
        return folder / f"{photo_id}.{extension.lstrip('.')}"

    def derived_path(self, user_id: UUID, photo_id: UUID, suffix: str) -> Path:
        folder = self.user_dir(user_id) / "derived"
        folder.mkdir(parents=True, exist_ok=True)
        return folder / f"{photo_id}_{suffix}.jpg"

    def resolve(self, relative_path: str) -> Path:
        candidate = (self.root / relative_path).resolve()
        if self.root != candidate and self.root not in candidate.parents:
            raise AppError("Invalid storage path", status_code=400, code="invalid_path")
        return candidate

    def relative(self, path: Path) -> str:
        return path.resolve().relative_to(self.root).as_posix()

    def delete(self, relative_path: str | None) -> None:
        if not relative_path:
            return
        with contextlib.suppress(OSError, AppError):
            self.resolve(relative_path).unlink(missing_ok=True)

    def delete_photo_files(self, relative_paths: list[str | None]) -> None:
        for path in relative_paths:
            self.delete(path)

    def cleanup_task_dir(self, user_id: UUID, task_id: UUID) -> None:
        shutil.rmtree(self.user_dir(user_id) / "_incoming" / str(task_id), ignore_errors=True)


storage = Storage()
