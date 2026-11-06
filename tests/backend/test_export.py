"""Trip export archive tests."""

from __future__ import annotations

import io
import json
import zipfile


def test_export_contains_portable_data(
    client, auth, create_trip, create_place, attach_place, upload_photo
):
    trip = create_trip(auth.headers)
    place = create_place(auth.headers)
    attach_place(auth.headers, trip["id"], place["id"])
    _, task = upload_photo(auth.headers, trip_id=trip["id"])
    assert task["status"] == "succeeded"

    response = client.get(f"/api/v1/trips/{trip['id']}/export", headers=auth.headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"

    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        names = set(archive.namelist())
        assert {
            "manifest.json",
            "trip.json",
            "timeline.json",
            "places.geojson",
            "photos.json",
            "README.txt",
        } <= names
        photo_files = [
            name for name in names if name.startswith("photos/") and name.endswith(".jpg")
        ]
        assert len(photo_files) == 1

        manifest = json.loads(archive.read("manifest.json"))
        assert manifest["application"] == "TravelTrace"
        assert manifest["counts"]["photos"] == 1
        assert manifest["counts"]["places"] == 1
        assert manifest["trip"]["id"] == trip["id"]

        trip_data = json.loads(archive.read("trip.json"))
        assert trip_data["title"] == "Kyoto in Autumn"

        places = json.loads(archive.read("places.geojson"))
        assert places["type"] == "FeatureCollection"
        assert len(places["features"]) == 1
        assert places["features"][0]["properties"]["name"] == "Kiyomizu-dera"

        photos = json.loads(archive.read("photos.json"))
        assert photos[0]["id"] == task["result"]["photo_ids"][0]
        assert photos[0]["gps_source"] == "exif"


def test_export_without_originals(client, auth, create_trip, upload_photo):
    trip = create_trip(auth.headers)
    upload_photo(auth.headers, trip_id=trip["id"])
    response = client.get(
        f"/api/v1/trips/{trip['id']}/export?include_originals=false",
        headers=auth.headers,
    )
    assert response.status_code == 200
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        assert not [name for name in archive.namelist() if name.startswith("photos/")]
        photos = json.loads(archive.read("photos.json"))
        assert photos[0]["file"] is None


def test_export_is_private(client, auth, other_auth, create_trip):
    trip = create_trip(auth.headers)
    response = client.get(f"/api/v1/trips/{trip['id']}/export", headers=other_auth.headers)
    assert response.status_code == 404
