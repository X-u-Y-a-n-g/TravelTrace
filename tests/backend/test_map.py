"""Map markers and route geometry tests."""

from __future__ import annotations


def _trip(client, headers, **overrides):
    payload = {
        "title": "Japan 2026",
        "start_date": "2026-10-01",
        "end_date": "2026-10-05",
    }
    payload.update(overrides)
    response = client.post("/api/v1/trips", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_markers_include_places_and_photos(client, auth, create_place, attach_place, upload_photo):
    trip = _trip(client, auth.headers)
    osaka = create_place(
        auth.headers,
        name="Osaka Castle",
        category="attraction",
        latitude=34.6937,
        longitude=135.5,
    )
    food = create_place(
        auth.headers,
        name="Dotonbori",
        category="food",
        latitude=34.6687,
        longitude=135.5013,
        country="Japan",
    )
    attach_place(auth.headers, trip["id"], osaka["id"], sort_order=1)
    attach_place(auth.headers, trip["id"], food["id"], sort_order=2)
    upload_photo(
        auth.headers,
        trip_id=trip["id"],
        taken_at="2026-10-01T10:00:00",
        latitude=34.6,
        longitude=135.6,
    )
    upload_photo(
        auth.headers,
        trip_id=trip["id"],
        taken_at="2026-10-02T10:00:00",
        latitude=34.61,
        longitude=135.61,
        colour=(1, 2, 3),
    )

    response = client.get("/api/v1/map/markers", headers=auth.headers)
    assert response.status_code == 200
    body = response.json()
    kinds = [item["kind"] for item in body["items"]]
    assert kinds.count("place") == 2
    assert kinds.count("photo") == 2
    assert body["total"] == 4
    assert body["truncated"] is False

    by_category = client.get("/api/v1/map/markers?categories=food", headers=auth.headers).json()
    assert len(by_category["items"]) == 1
    assert by_category["items"][0]["title"] == "Dotonbori"

    bbox = client.get(
        "/api/v1/map/markers?bbox=135.45,34.65,135.52,34.70", headers=auth.headers
    ).json()
    assert all(
        135.45 <= marker["longitude"] <= 135.52 and 34.65 <= marker["latitude"] <= 34.70
        for marker in bbox["items"]
    )
    assert len(bbox["items"]) == 2  # both places

    empty_trip = _trip(
        client,
        auth.headers,
        title="Empty",
        start_date="2020-01-01",
        end_date="2020-01-02",
    )
    filtered = client.get(
        f"/api/v1/map/markers?trip_ids={empty_trip['id']}", headers=auth.headers
    ).json()
    assert filtered["items"] == []


def test_routes_prefer_ordered_places(client, auth, create_trip, create_place, attach_place):
    trip = create_trip(auth.headers)
    place_a = create_place(auth.headers, name="Osaka Castle", latitude=34.6937, longitude=135.5)
    place_b = create_place(auth.headers, name="Dotonbori", latitude=34.6687, longitude=135.5013)
    attach_place(auth.headers, trip["id"], place_a["id"], sort_order=1)
    attach_place(auth.headers, trip["id"], place_b["id"], sort_order=2)

    body = client.get("/api/v1/map/routes", headers=auth.headers).json()
    assert body["type"] == "FeatureCollection"
    assert len(body["features"]) == 1
    feature = body["features"][0]
    assert feature["geometry"]["type"] == "LineString"
    assert feature["geometry"]["coordinates"][0] == [135.5, 34.6937]
    assert feature["properties"]["kind"] == "places"
    assert feature["properties"]["stop_count"] == 2
    assert feature["properties"]["trip_id"] == trip["id"]

    single = client.get(f"/api/v1/map/routes?trip_id={trip['id']}", headers=auth.headers).json()
    assert len(single["features"]) == 1


def test_routes_fall_back_to_photo_positions(client, auth, create_trip, upload_photo):
    trip = create_trip(auth.headers)
    upload_photo(
        auth.headers,
        trip_id=trip["id"],
        taken_at="2026-10-01T09:00:00",
        latitude=34.69,
        longitude=135.5,
    )
    upload_photo(
        auth.headers,
        trip_id=trip["id"],
        taken_at="2026-10-01T11:00:00",
        latitude=34.70,
        longitude=135.51,
        colour=(3, 4, 5),
    )
    body = client.get("/api/v1/map/routes", headers=auth.headers).json()
    assert len(body["features"]) == 1
    feature = body["features"][0]
    assert feature["properties"]["kind"] == "photos"
    assert feature["geometry"]["coordinates"] == [[135.5, 34.69], [135.51, 34.7]]


def test_deleted_trip_is_not_mapped(client, auth, create_trip, create_place, attach_place):
    trip = create_trip(auth.headers)
    place = create_place(auth.headers, latitude=34.6937, longitude=135.5)
    attach_place(auth.headers, trip["id"], place["id"])
    assert client.get("/api/v1/map/markers", headers=auth.headers).json()["total"] == 1

    client.delete(f"/api/v1/trips/{trip['id']}", headers=auth.headers)
    assert client.get("/api/v1/map/markers", headers=auth.headers).json()["total"] == 0


def test_invalid_bbox_is_rejected(client, auth):
    response = client.get("/api/v1/map/markers?bbox=1,2,3", headers=auth.headers)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_bbox"
