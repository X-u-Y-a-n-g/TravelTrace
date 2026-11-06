"""PostgreSQL + PostGIS integration test (opt-in via environment)."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.models import Photo, Trip, User

pytestmark = pytest.mark.postgres

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"


def test_postgis_geography_roundtrip():
    url = os.environ.get("TRAVELTRACE_TEST_DATABASE_URL")
    if not url:
        pytest.skip("TRAVELTRACE_TEST_DATABASE_URL is not configured")

    environment = os.environ.copy()
    environment["TRAVELTRACE_DATABASE_URL"] = url
    migration = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND,
        env=environment,
        capture_output=True,
        text=True,
        timeout=180,
        check=False,
    )
    assert migration.returncode == 0, migration.stderr

    engine = create_engine(url, future=True)
    try:
        with engine.connect() as connection:
            column_type = connection.execute(
                text(
                    "select udt_name from information_schema.columns "
                    "where table_name='photos' and column_name='location'"
                )
            ).scalar()
            assert column_type == "geography"

            spatial_index = connection.execute(
                text(
                    "select indexdef from pg_indexes "
                    "where tablename='photos' and indexname='ix_photos_location_gist'"
                )
            ).scalar()
            assert spatial_index is not None and "gist" in spatial_index.lower()

        Session = sessionmaker(bind=engine, expire_on_commit=False)
        with Session() as session:
            user = User(
                username="postgres-tester",
                email="postgres-tester@example.com",
                password_hash="x",
            )
            session.add(user)
            session.flush()
            trip = Trip(user_id=user.id, title="PostGIS trip")
            session.add(trip)
            session.flush()
            photo = Photo(
                user_id=user.id,
                trip_id=trip.id,
                file_path="photos/one.jpg",
                original_filename="one.jpg",
                mime_type="image/jpeg",
                file_size=1,
                content_hash="hash-one",
                latitude=34.6937,
                longitude=135.5,
            )
            session.add(photo)
            session.commit()

            row = session.execute(
                text("select ST_AsText(location), ST_SRID(location) from photos")
            ).one()
            assert row[0].startswith("POINT(135.5 34.6937")
            assert row[1] == 4326
    finally:
        with engine.begin() as connection:
            connection.exec_driver_sql("DROP SCHEMA public CASCADE")
            connection.exec_driver_sql("CREATE SCHEMA public")
        engine.dispose()
