"""Trip CRUD and ownership tests."""

from __future__ import annotations


def test_create_and_get_trip(client, auth, create_trip):
    trip = create_trip(auth.headers)
    assert trip["title"] == "Kyoto in Autumn"
    assert trip["day_count"] == 5
    assert trip["stats"]["day_count"] == 5
    assert trip["visibility"] == "private"

    response = client.get(f"/api/v1/trips/{trip['id']}", headers=auth.headers)
    assert response.status_code == 200
    assert response.json()["id"] == trip["id"]


def test_trip_validation(client, auth):
    invalid_dates = client.post(
        "/api/v1/trips",
        json={
            "title": "Backwards",
            "start_date": "2026-10-05",
            "end_date": "2026-10-01",
        },
        headers=auth.headers,
    )
    assert invalid_dates.status_code == 422
    assert invalid_dates.json()["error"]["code"] == "validation_error"

    empty_title = client.post("/api/v1/trips", json={"title": "   "}, headers=auth.headers)
    assert empty_title.status_code == 422


def test_update_trip(client, auth, create_trip):
    trip = create_trip(auth.headers)
    response = client.patch(
        f"/api/v1/trips/{trip['id']}",
        json={
            "title": "Kyoto & Nara",
            "visibility": "public",
            "end_date": "2026-10-07",
        },
        headers=auth.headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Kyoto & Nara"
    assert body["visibility"] == "public"
    assert body["day_count"] == 7

    bad_dates = client.patch(
        f"/api/v1/trips/{trip['id']}",
        json={"start_date": "2026-10-08"},
        headers=auth.headers,
    )
    assert bad_dates.status_code == 422


def test_set_cover_photo(client, auth, create_trip, upload_photo):
    trip = create_trip(auth.headers)
    _, task = upload_photo(auth.headers, trip_id=trip["id"])
    assert task["status"] == "succeeded"
    photo_id = task["result"]["photo_ids"][0]

    response = client.patch(
        f"/api/v1/trips/{trip['id']}",
        json={"cover_photo_id": photo_id},
        headers=auth.headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["cover_photo_id"] == photo_id
    assert body["cover_photo"]["id"] == photo_id

    cleared = client.patch(
        f"/api/v1/trips/{trip['id']}",
        json={"cover_photo_id": None},
        headers=auth.headers,
    )
    assert cleared.status_code == 200
    assert cleared.json()["cover_photo_id"] is None


def test_list_filters_and_pagination(client, auth, create_trip):
    create_trip(
        auth.headers,
        title="Kyoto in Autumn",
        start_date="2026-10-01",
        end_date="2026-10-05",
    )
    create_trip(
        auth.headers,
        title="Yunnan Escape",
        start_date="2025-04-01",
        end_date="2025-04-10",
        visibility="public",
    )
    create_trip(auth.headers, title="Beijing Weekend", start_date=None, end_date=None)

    all_trips = client.get("/api/v1/trips", headers=auth.headers).json()
    assert all_trips["total"] == 3

    by_year = client.get("/api/v1/trips?year=2026", headers=auth.headers).json()
    assert by_year["total"] == 1
    assert by_year["items"][0]["title"] == "Kyoto in Autumn"

    by_query = client.get("/api/v1/trips?q=yunnan", headers=auth.headers).json()
    assert by_query["total"] == 1

    by_visibility = client.get("/api/v1/trips?visibility=public", headers=auth.headers).json()
    assert by_visibility["total"] == 1

    page = client.get("/api/v1/trips?size=2&page=1", headers=auth.headers).json()
    assert page["size"] == 2
    assert len(page["items"]) == 2
    assert page["pages"] == 2

    title_sorted = client.get("/api/v1/trips?sort=title_asc", headers=auth.headers).json()
    titles = [trip["title"] for trip in title_sorted["items"]]
    assert titles == sorted(titles)


def test_soft_delete_and_restore(client, auth, create_trip, upload_photo):
    trip = create_trip(auth.headers)
    _, task = upload_photo(auth.headers, trip_id=trip["id"])
    photo_id = task["result"]["photo_ids"][0]

    deleted = client.delete(f"/api/v1/trips/{trip['id']}", headers=auth.headers)
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/trips/{trip['id']}", headers=auth.headers).status_code == 404
    visible_photos = client.get("/api/v1/photos", headers=auth.headers).json()
    assert visible_photos["total"] == 0

    restored = client.post(f"/api/v1/trips/{trip['id']}/restore", headers=auth.headers)
    assert restored.status_code == 200
    assert restored.json()["photo_count"] == 1
    photos_again = client.get("/api/v1/photos", headers=auth.headers).json()
    assert photos_again["total"] == 1
    assert photos_again["items"][0]["id"] == photo_id


def test_trips_are_private_to_their_owner(client, auth, other_auth, create_trip):
    trip = create_trip(auth.headers)
    assert client.get(f"/api/v1/trips/{trip['id']}", headers=other_auth.headers).status_code == 404
    assert (
        client.patch(
            f"/api/v1/trips/{trip['id']}",
            json={"title": "Hijacked"},
            headers=other_auth.headers,
        ).status_code
        == 404
    )
    assert (
        client.delete(f"/api/v1/trips/{trip['id']}", headers=other_auth.headers).status_code == 404
    )

    other_list = client.get("/api/v1/trips", headers=other_auth.headers).json()
    assert other_list["total"] == 0
