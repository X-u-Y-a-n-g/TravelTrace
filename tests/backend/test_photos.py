"""Photo upload, EXIF extraction and library tests."""

from __future__ import annotations

import io


def test_upload_extracts_exif_and_creates_derivatives(client, auth, create_trip, upload_photo):
    trip = create_trip(auth.headers)
    _, task = upload_photo(auth.headers, trip_id=trip["id"])
    assert task["status"] == "succeeded"
    assert task["result"]["imported"] == 1
    assert task["progress"] == 100

    photo_id = task["result"]["photo_ids"][0]
    photo = client.get(f"/api/v1/photos/{photo_id}", headers=auth.headers).json()
    assert photo["trip_id"] == trip["id"]
    assert photo["taken_at"] == "2026-10-01T10:30:00"
    assert photo["taken_at_offset_minutes"] == 540
    assert abs(photo["latitude"] - 34.6937) < 1e-4
    assert abs(photo["longitude"] - 135.5) < 1e-6
    assert photo["gps_source"] == "exif"
    assert photo["camera_make"] == "Canon"
    assert photo["camera_model"] == "EOS R6"
    assert photo["has_gps"] is True
    assert photo["status"] == "ready"
    assert photo["width"] == 960

    sizes = {}
    for size in ("thumb", "preview", "original"):
        response = client.get(f"/api/v1/photos/{photo_id}/file?size={size}", headers=auth.headers)
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("image/")
        assert response.headers["cache-control"].startswith("private")
        sizes[size] = len(response.content)
    assert sizes["thumb"] < sizes["preview"] < sizes["original"]


def test_photo_file_cookie_auth(client, auth, create_trip, upload_photo):
    trip = create_trip(auth.headers)
    _, task = upload_photo(auth.headers, trip_id=trip["id"])
    photo_id = task["result"]["photo_ids"][0]

    client.cookies.clear()
    assert client.get(f"/api/v1/photos/{photo_id}/file").status_code == 401

    login = client.post(
        "/api/v1/auth/login",
        json={"identifier": auth.user["username"], "password": "supersecret123"},
    )
    assert login.status_code == 200
    assert client.get(f"/api/v1/photos/{photo_id}/file").status_code == 200


def test_photo_file_accepts_media_token_query(client, auth, create_trip, upload_photo):
    trip = create_trip(auth.headers)
    _, task = upload_photo(auth.headers, trip_id=trip["id"])
    photo_id = task["result"]["photo_ids"][0]

    client.cookies.clear()
    response = client.get(f"/api/v1/photos/{photo_id}/file?size=thumb&access_token={auth.token}")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/")

    assert client.get(f"/api/v1/photos/{photo_id}/file?access_token=not-a-token").status_code == 401


def test_upload_infers_trip_from_date(client, auth, create_trip, upload_photo):
    trip = create_trip(auth.headers)
    _, task = upload_photo(auth.headers, taken_at="2026-10-03T18:05:00")
    photo = client.get(
        f"/api/v1/photos/{task['result']['photo_ids'][0]}", headers=auth.headers
    ).json()
    assert photo["trip_id"] == trip["id"]


def test_upload_outside_trip_dates_is_unsorted(client, auth, create_trip, upload_photo):
    create_trip(auth.headers)
    _, task = upload_photo(auth.headers, taken_at="2024-01-15T09:00:00")
    photo_id = task["result"]["photo_ids"][0]
    photo = client.get(f"/api/v1/photos/{photo_id}", headers=auth.headers).json()
    assert photo["trip_id"] is None

    unsorted = client.get("/api/v1/photos?unsorted=true", headers=auth.headers).json()
    assert unsorted["total"] == 1


def test_upload_without_exif(client, auth, upload_photo):
    _, task = upload_photo(auth.headers, taken_at=None, latitude=None, longitude=None)
    assert task["status"] == "succeeded"
    photo = client.get(
        f"/api/v1/photos/{task['result']['photo_ids'][0]}", headers=auth.headers
    ).json()
    assert photo["taken_at"] is None
    assert photo["has_gps"] is False
    assert photo["gps_source"] == "none"


def test_duplicate_uploads_are_skipped(client, auth, create_trip, upload_photo):
    trip = create_trip(auth.headers)
    upload_photo(auth.headers, trip_id=trip["id"])
    _, second = upload_photo(auth.headers, trip_id=trip["id"])
    assert second["status"] == "succeeded"
    assert second["result"]["imported"] == 0
    assert second["result"]["skipped"] == 1
    assert "already" in second["message"].lower()

    photos = client.get("/api/v1/photos", headers=auth.headers).json()
    assert photos["total"] == 1


def test_invalid_image_is_rejected(client, auth):
    response = client.post(
        "/api/v1/photos/upload",
        files={"files": ("notes.jpg", io.BytesIO(b"this is not an image"), "image/jpeg")},
        headers=auth.headers,
    )
    assert response.status_code == 202
    task = client.get(f"/api/v1/imports/{response.json()['task_id']}", headers=auth.headers).json()
    assert task["status"] == "failed"
    assert task["failed"] == 1
    assert client.get("/api/v1/photos", headers=auth.headers).json()["total"] == 0


def test_empty_upload_is_rejected(client, auth):
    response = client.post(
        "/api/v1/photos/upload",
        files={"files": ("empty.jpg", io.BytesIO(b""), "image/jpeg")},
        headers=auth.headers,
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "empty_file"


def test_photo_update_and_bulk_assignment(client, auth, create_trip, upload_photo):
    trip = create_trip(auth.headers)
    _, task = upload_photo(auth.headers, latitude=None, longitude=None)
    photo_id = task["result"]["photo_ids"][0]

    updated = client.patch(
        f"/api/v1/photos/{photo_id}",
        json={"latitude": 35.0116, "longitude": 135.7681, "caption": "By hand"},
        headers=auth.headers,
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["gps_source"] == "manual"
    assert body["latitude"] == 35.0116
    assert body["caption"] == "By hand"

    cleared = client.patch(
        f"/api/v1/photos/{photo_id}",
        json={"latitude": None, "longitude": None},
        headers=auth.headers,
    )
    assert cleared.status_code == 200
    assert cleared.json()["gps_source"] == "none"

    bulk = client.post(
        "/api/v1/photos/bulk",
        json={"photo_ids": [photo_id], "trip_id": trip["id"], "is_favorite": True},
        headers=auth.headers,
    )
    assert bulk.status_code == 200
    assert bulk.json()["updated"] == 1
    photo = client.get(f"/api/v1/photos/{photo_id}", headers=auth.headers).json()
    assert photo["trip_id"] == trip["id"]
    assert photo["is_favorite"] is True


def test_photo_filters_and_sorting(client, auth, create_trip, upload_photo):
    trip = create_trip(auth.headers)
    _, first_task = upload_photo(auth.headers, trip_id=trip["id"], taken_at="2026-10-01T09:00:00")
    _, second_task = upload_photo(
        auth.headers,
        trip_id=trip["id"],
        taken_at="2026-10-02T20:00:00",
        latitude=None,
        longitude=None,
        colour=(10, 20, 30),
    )
    first_id = first_task["result"]["photo_ids"][0]
    second_id = second_task["result"]["photo_ids"][0]

    by_trip = client.get(f"/api/v1/photos?trip_id={trip['id']}", headers=auth.headers).json()
    assert by_trip["total"] == 2

    by_gps = client.get("/api/v1/photos?has_gps=true", headers=auth.headers).json()
    assert by_gps["total"] == 1
    assert by_gps["items"][0]["id"] == first_id

    no_gps = client.get("/api/v1/photos?has_gps=false", headers=auth.headers).json()
    assert no_gps["total"] == 1
    assert no_gps["items"][0]["id"] == second_id

    newest = client.get("/api/v1/photos", headers=auth.headers).json()
    assert newest["items"][0]["id"] == second_id
    ascending = client.get("/api/v1/photos?sort=taken_at_asc", headers=auth.headers).json()
    assert ascending["items"][0]["id"] == first_id

    date_filtered = client.get("/api/v1/photos?date_from=2026-10-02", headers=auth.headers).json()
    assert date_filtered["total"] == 1
    assert date_filtered["items"][0]["id"] == second_id


def test_photo_delete_and_ownership(client, auth, other_auth, create_trip, upload_photo):
    trip = create_trip(auth.headers)
    _, task = upload_photo(auth.headers, trip_id=trip["id"])
    photo_id = task["result"]["photo_ids"][0]

    assert client.get(f"/api/v1/photos/{photo_id}", headers=other_auth.headers).status_code == 404
    assert (
        client.get(f"/api/v1/photos/{photo_id}/file", headers=other_auth.headers).status_code == 404
    )
    assert (
        client.patch(
            f"/api/v1/photos/{photo_id}",
            json={"caption": "x"},
            headers=other_auth.headers,
        ).status_code
        == 404
    )

    deleted = client.delete(f"/api/v1/photos/{photo_id}", headers=auth.headers)
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/photos/{photo_id}", headers=auth.headers).status_code == 404
    assert client.get("/api/v1/photos", headers=auth.headers).json()["total"] == 0
    assert client.get(f"/api/v1/photos/{photo_id}/file", headers=auth.headers).status_code == 404
