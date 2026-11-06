"""Database migration tests (SQLite baseline)."""

from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"


def _run_alembic(database: Path, *arguments: str) -> subprocess.CompletedProcess:
    environment = os.environ.copy()
    environment["TRAVELTRACE_DATABASE_URL"] = f"sqlite:///{database.as_posix()}"
    environment.pop("TRAVELTRACE_STORAGE_DIR", None)
    return subprocess.run(
        [sys.executable, "-m", "alembic", *arguments],
        cwd=BACKEND,
        env=environment,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )


def test_migrations_upgrade_and_downgrade(tmp_path):
    database = tmp_path / "migration.db"

    upgrade = _run_alembic(database, "upgrade", "head")
    assert upgrade.returncode == 0, upgrade.stderr

    connection = sqlite3.connect(database)
    try:
        tables = {
            row[0]
            for row in connection.execute("select name from sqlite_master where type='table'")
        }
        expected = {
            "users",
            "trips",
            "trip_members",
            "places",
            "trip_places",
            "photos",
            "timeline_events",
            "event_media",
            "tracks",
            "track_points",
            "journals",
            "memory_books",
            "import_tasks",
            "alembic_version",
        }
        assert expected <= tables

        revision = connection.execute("select version_num from alembic_version").fetchone()[0]
        assert revision == "0001_initial"

        photos_sql = connection.execute(
            "select sql from sqlite_master where name='photos'"
        ).fetchone()[0]
        assert "content_hash" in photos_sql
        assert "taken_at" in photos_sql
        assert "location TEXT" in photos_sql
    finally:
        connection.close()

    downgrade = _run_alembic(database, "downgrade", "base")
    assert downgrade.returncode == 0, downgrade.stderr
    connection = sqlite3.connect(database)
    try:
        tables = {
            row[0]
            for row in connection.execute("select name from sqlite_master where type='table'")
        }
        assert "photos" not in tables
        assert "trips" not in tables
    finally:
        connection.close()
