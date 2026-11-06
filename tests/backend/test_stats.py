"""Dashboard statistics tests."""

from __future__ import annotations


def _create_place(client, headers, **overrides):
    payload = {
        "name": "Osaka Castle",
        "category": "attraction",
        "city": "Osaka",
        "country": "Japan",
        "country_code": "JP",
        "latitude": 34.6937,
        "longitude": 135.5,
    }
    payload.update(overrides)
    response = client.post("/api/v1/places", json=payload, headers=headers)
    assert response.status_code == 201
    return response.json()


def test_overview_aggregates(client, auth, create_trip, upload_photo):
    japan_trip = create_trip(
        auth.headers,
        title="Japan 2026",
        start_date="2026-10-01",
        end_date="2026-10-05",
    )
    china_trip = create_trip(
        auth.headers,
        title="Shanghai 2025",
        start_date="2025-04-01",
        end_date="2025-04-04",
    )
    japan_place = _create_place(client, auth.headers)
    china_place = _create_place(
        client,
        auth.headers,
        name="The Bund",
        city="Shanghai",
        country="China",
        country_code="CN",
        latitude=31.2397,
        longitude=121.4903,
    )
    for trip, place in ((japan_trip, japan_place), (china_trip, china_place)):
        response = client.post(
            f"/api/v1/trips/{trip['id']}/places",
            json={"place_id": place["id"]},
            headers=auth.headers,
        )
        assert response.status_code == 201

    upload_photo(
        auth.headers,
        trip_id=japan_trip["id"],
        taken_at="2026-10-01T10:00:00",
        latitude=34.6937,
        longitude=135.5,
    )
    upload_photo(
        auth.headers,
        trip_id=japan_trip["id"],
        taken_at="2026-10-02T11:00:00",
        latitude=34.6938,
        longitude=135.5001,
        colour=(9, 9, 9),
    )
    upload_photo(
        auth.headers,
        trip_id=china_trip["id"],
        taken_at="2025-04-02T11:00:00",
        latitude=31.2397,
        longitude=121.4903,
        colour=(12, 34, 56),
    )

    response = client.get("/api/v1/stats/overview", headers=auth.headers)
    assert response.status_code == 200
    body = response.json()
    assert body["trips"] == 2
    assert body["days"] == 9
    assert body["photos"] == 3
    assert body["gps_photos"] == 3
    assert body["places"] == 2
    assert body["countries"] == 2
    assert body["cities"] == 2
    assert body["storage_bytes"] > 0
    assert len(body["recent_trips"]) == 2
    assert len(body["recent_photos"]) == 3

    years = {item["year"]: item for item in body["years"]}
    assert years[2026]["trips"] == 1
    assert years[2026]["photos"] == 2
    assert years[2025]["photos"] == 1

    countries = {item["country"]: item for item in body["countries_detail"]}
    assert countries["Japan"]["place_count"] == 1
    assert countries["Japan"]["photo_count"] == 2
    assert countries["China"]["country_code"] == "CN"

    photo_id = body["recent_photos"][0]["id"]
    client.patch(f"/api/v1/photos/{photo_id}", json={"is_favorite": True}, headers=auth.headers)
    refreshed = client.get("/api/v1/stats/overview", headers=auth.headers).json()
    assert refreshed["favorite_photos"] == 1


def test_empty_overview(client, auth):
    body = client.get("/api/v1/stats/overview", headers=auth.headers).json()
    assert body["trips"] == 0
    assert body["photos"] == 0
    assert body["countries_detail"] == []
    assert body["recent_trips"] == []
    assert body["years"] == []


def test_instance_settings(client, auth):
    body = client.get("/api/v1/settings", headers=auth.headers).json()
    assert body["app_name"] == "TravelTrace"
    assert body["app_version"] == "0.1.1"
    assert body["max_upload_mb"] > 0
    assert body["geocoding_enabled"] is False
    assert body["storage_used_bytes"] == 0
