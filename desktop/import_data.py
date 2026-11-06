"""Import an existing TravelTrace SQLite database and uploads directory."""

from __future__ import annotations

import shutil
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from desktop.paths import executable_dir


@dataclass(slots=True)
class ImportSummary:
    database: Path
    uploads: Path
    photos: int
    trips: int
    backup: Path | None = None


def _find_database(source: Path) -> Path | None:
    if source.is_file() and source.suffix.lower() in {".db", ".sqlite", ".sqlite3"}:
        return source
    if not source.is_dir():
        return None
    candidates = [
        source / "traveltrace.db",
        source / "backend" / "data" / "traveltrace.db",
        source / "data" / "traveltrace.db",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


def _find_uploads(source: Path, database: Path) -> Path | None:
    candidates = []
    if source.is_dir():
        candidates.extend([source / "uploads", source / "backend" / "data" / "uploads"])
    candidates.append(database.parent / "uploads")
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    return None


def _validate_database(path: Path) -> tuple[int, int]:
    try:
        connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    except sqlite3.Error as exc:
        raise ValueError(f"无法打开数据库: {exc}") from exc
    try:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        required = {"users", "trips", "photos"}
        if not required.issubset(tables):
            raise ValueError("这个数据库看起来不是 TravelTrace 数据库（缺少 users/trips/photos）")
        photos = connection.execute("SELECT count(*) FROM photos").fetchone()[0]
        trips = connection.execute("SELECT count(*) FROM trips").fetchone()[0]
        return int(photos), int(trips)
    finally:
        connection.close()


def import_existing_data(source: Path, data_dir: Path) -> ImportSummary:
    """Copy an old SQLite DB + uploads into the desktop data directory."""
    source = source.expanduser().resolve()
    data_dir.mkdir(parents=True, exist_ok=True)
    database = _find_database(source)
    if database is None:
        raise FileNotFoundError(
            "未找到 traveltrace.db。请选择包含 traveltrace.db 的目录，"
            "或 backend/data 目录。"
        )
    photos, trips = _validate_database(database)

    uploads_source = _find_uploads(source, database)
    target_db = data_dir / "traveltrace.db"
    target_uploads = data_dir / "uploads"
    target_uploads.mkdir(parents=True, exist_ok=True)

    backup: Path | None = None
    if target_db.exists() and target_db.stat().st_size > 0:
        backup = data_dir / f"traveltrace.backup-{datetime.now():%Y%m%d-%H%M%S}.db"
        shutil.copy2(target_db, backup)

    # Use SQLite's backup API so a live source database (including its WAL) is
    # copied consistently instead of copying only the main .db file.
    source_connection = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
    target_connection = sqlite3.connect(target_db)
    try:
        source_connection.backup(target_connection)
        target_connection.commit()
    finally:
        target_connection.close()
        source_connection.close()

    if uploads_source is not None:
        shutil.copytree(uploads_source, target_uploads, dirs_exist_ok=True)

    return ImportSummary(
        database=target_db,
        uploads=target_uploads,
        photos=photos,
        trips=trips,
        backup=backup,
    )


def candidate_sources() -> list[Path]:
    """Common locations to look for an old installation."""
    here = Path.cwd()
    exe_dir = executable_dir()
    candidates = [
        here / "backend" / "data",
        here / "data",
        here / ".cache" / "devdata",
        exe_dir / "backend" / "data",
        exe_dir / "data",
    ]
    seen: set[Path] = set()
    result = []
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved not in seen and _find_database(resolved) is not None:
            seen.add(resolved)
            result.append(resolved)
    return result
