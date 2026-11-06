"""Place and trip-visit tests."""

from __future__ import annotations

from app.schemas.place import GeocodeResult


def test_place_crud(client, auth, create_place):
    place = create_place(auth.headers)
    assert place["name"] == "Kiyomizu-dera"
    assert place["category"] == "attraction"
    assert place["country_code"] == "JP"
    assert place["photo_count"] == 0

    listed = client.get("/api/v1/places", headers=auth.headers).json()
    assert listed["total"] == 1

    detail = client.get(f"/api/v1/places/{place['id']}", headers=auth.headers)
    assert detail.status_code == 200

    updated = client.patch(
        f"/api/v1/places/{place['id']}",
        json={"name": "Kiyomizu-dera Temple", "category": "nature"},
        headers=auth.headers,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Kiyomizu-dera Temple"
    assert updated.json()["category"] == "nature"

    deleted = client.delete(f"/api/v1/places/{place['id']}", headers=auth.headers)
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/places/{place['id']}", headers=auth.headers).status_code == 404


def test_place_coordinate_validation(client, auth):
    response = client.post(
        "/api/v1/places",
        json={"name": "Nowhere", "latitude": 35.0},
        headers=auth.headers,
    )
    assert response.status_code == 422

    out_of_range = client.post(
        "/api/v1/places",
        json={"name": "Atlantis", "latitude": 120, "longitude": 10},
        headers=auth.headers,
    )
    assert out_of_range.status_code == 422


def test_place_filters(client, auth, create_place):
    create_place(auth.headers, name="Nishiki Market", category="food", city="Kyoto")
    create_place(auth.headers, name="Tokyo Tower", category="attraction", city="Tokyo")

    by_category = client.get("/api/v1/places?category=food", headers=auth.headers).json()
    assert by_category["total"] == 1
    assert by_category["items"][0]["name"] == "Nishiki Market"

    by_query = client.get("/api/v1/places?q=tokyo", headers=auth.headers).json()
    assert by_query["total"] == 1

    by_bbox = client.get("/api/v1/places?bbox=135.0,34.0,136.0,35.5", headers=auth.headers).json()
    assert by_bbox["total"] == 2

    categories = client.get("/api/v1/places/categories", headers=auth.headers).json()
    assert "food" in categories and "attraction" in categories


def test_trip_visits(client, auth, create_trip, create_place, attach_place):
    trip = create_trip(auth.headers)
    place = create_place(auth.headers)

    visit = attach_place(
        auth.headers,
        trip["id"],
        place["id"],
        arrival_time="2026-10-02T10:00:00",
        departure_time="2026-10-02T12:30:00",
    )
    assert visit["sort_order"] == 1
    assert visit["day"] == "2026-10-02"

    duplicate = client.post(
        f"/api/v1/trips/{trip['id']}/places",
        json={"place_id": place["id"]},
        headers=auth.headers,
    )
    assert duplicate.status_code == 409

    updated = client.patch(
        f"/api/v1/trips/{trip['id']}/places/{visit['id']}",
        json={"notes": "Crowded but beautiful", "sort_order": 5},
        headers=auth.headers,
    )
    assert updated.status_code == 200
    assert updated.json()["notes"] == "Crowded but beautiful"

    detail = client.get(f"/api/v1/trips/{trip['id']}", headers=auth.headers).json()
    assert detail["place_count"] == 1
    assert detail["places"][0]["place"]["name"] == place["name"]

    removed = client.delete(
        f"/api/v1/trips/{trip['id']}/places/{visit['id']}", headers=auth.headers
    )
    assert removed.status_code == 204
    assert (
        client.get(f"/api/v1/trips/{trip['id']}", headers=auth.headers).json()["place_count"] == 0
    )


def test_place_photos_are_matched_by_proximity(
    client, auth, create_trip, create_place, upload_photo
):
    trip = create_trip(auth.headers)
    create_place(auth.headers, latitude=34.6937, longitude=135.5, name="Osaka Castle")
    _, task = upload_photo(auth.headers, trip_id=trip["id"], latitude=34.69372, longitude=135.5)
    assert task["status"] == "succeeded"

    photos = client.get("/api/v1/photos", headers=auth.headers).json()
    photo = photos["items"][0]
    assert photo["place_id"] is not None
    assert photo["place"]["name"] == "Osaka Castle"


def test_geocoding_disabled(client, auth):
    response = client.post(
        "/api/v1/places/geocode",
        json={"latitude": 34.6937, "longitude": 135.5},
        headers=auth.headers,
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "geocoding_disabled"


def test_geocoding_with_fake_provider(client, auth, monkeypatch):
    from app.services import place_service

    class FakeProvider:
        name = "fake"

        def reverse(self, latitude, longitude):
            return GeocodeResult(
                provider="fake",
                display_name="Osaka Castle, Chuo Ward, Osaka, Japan",
                name="Osaka Castle",
                address="Osaka Castle",
                city="Osaka",
                region="Osaka",
                country="Japan",
                country_code="JP",
                latitude=latitude,
                longitude=longitude,
            )

    monkeypatch.setattr(place_service, "get_geocoding_provider", lambda: FakeProvider())
    response = client.post(
        "/api/v1/places/geocode",
        json={"latitude": 34.6873, "longitude": 135.5262},
        headers=auth.headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "fake"
    assert body["name"] == "Osaka Castle"
    assert body["country_code"] == "JP"


def test_places_are_private(client, auth, other_auth, create_place):
    place = create_place(auth.headers)
    assert (
        client.get(f"/api/v1/places/{place['id']}", headers=other_auth.headers).status_code == 404
    )
