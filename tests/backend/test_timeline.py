"""Timeline generation and event management tests."""

from __future__ import annotations


def _upload(upload_photo, headers, **kwargs) -> str:
    _, task = upload_photo(headers, **kwargs)
    assert task["status"] == "succeeded", task
    return task["result"]["photo_ids"][0]


def _seed_photos(client, auth, create_trip, create_place, upload_photo, attach_place):
    trip = create_trip(auth.headers)
    osaka = create_place(auth.headers, name="Osaka Castle", latitude=34.6937, longitude=135.5)
    kyoto = create_place(
        auth.headers,
        name="Kiyomizu-dera",
        city="Kyoto",
        latitude=34.9949,
        longitude=135.785,
    )
    attach_place(auth.headers, trip["id"], osaka["id"], arrival_time="2026-10-01T10:00:00")
    attach_place(auth.headers, trip["id"], kyoto["id"], arrival_time="2026-10-02T09:00:00")

    ids = [
        _upload(
            upload_photo,
            auth.headers,
            trip_id=trip["id"],
            taken_at="2026-10-01T09:00:00",
            latitude=34.6937,
            longitude=135.5,
            colour=(10, 10, 10),
        ),
        _upload(
            upload_photo,
            auth.headers,
            trip_id=trip["id"],
            taken_at="2026-10-01T09:25:00",
            latitude=34.6938,
            longitude=135.5001,
            colour=(20, 20, 20),
        ),
        _upload(
            upload_photo,
            auth.headers,
            trip_id=trip["id"],
            taken_at="2026-10-01T15:30:00",
            latitude=34.6687,
            longitude=135.5013,
            colour=(30, 30, 30),
        ),
        _upload(
            upload_photo,
            auth.headers,
            trip_id=trip["id"],
            taken_at="2026-10-02T10:00:00",
            latitude=34.9949,
            longitude=135.785,
            colour=(40, 40, 40),
        ),
    ]
    return trip, ids


def test_generate_timeline_clusters_photos(
    client, auth, create_trip, create_place, upload_photo, attach_place
):
    trip, _ = _seed_photos(client, auth, create_trip, create_place, upload_photo, attach_place)

    response = client.post(
        f"/api/v1/trips/{trip['id']}/timeline/generate",
        json={"max_gap_minutes": 180, "max_distance_km": 3},
        headers=auth.headers,
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["created_events"] == 3
    assert result["assigned_photos"] == 4

    timeline = result["timeline"]
    assert timeline["event_count"] == 3
    assert timeline["photo_count"] == 4
    assert len(timeline["days"]) == 2
    assert timeline["days"][0]["date"] == "2026-10-01"
    assert timeline["days"][0]["day_index"] == 1
    assert len(timeline["days"][0]["events"]) == 2
    assert timeline["days"][1]["day_index"] == 2

    first_event = timeline["days"][0]["events"][0]
    assert first_event["title"] == "Osaka Castle"
    assert first_event["source"] == "auto"
    assert first_event["status"] == "draft"
    assert first_event["event_type"] == "sightseeing"
    assert len(first_event["photos"]) == 2
    assert first_event["place"]["name"] == "Osaka Castle"
    assert timeline["days"][1]["events"][0]["title"] == "Kiyomizu-dera"


def test_regenerate_replaces_drafts_but_keeps_manual_events(
    client, auth, create_trip, create_place, upload_photo, attach_place
):
    trip, ids = _seed_photos(client, auth, create_trip, create_place, upload_photo, attach_place)

    manual = client.post(
        f"/api/v1/trips/{trip['id']}/events",
        json={
            "title": "Sunset by the river",
            "event_type": "activity",
            "start_time": "2026-10-03T18:00:00",
            "photo_ids": [ids[0]],
        },
        headers=auth.headers,
    )
    assert manual.status_code == 201, manual.text
    manual_event = manual.json()

    generated = client.post(
        f"/api/v1/trips/{trip['id']}/timeline/generate", json={}, headers=auth.headers
    ).json()
    assert generated["kept_manual_events"] == 1
    # The manually assigned photo is not re-clustered.
    assert generated["assigned_photos"] == 3
    titles = [event["title"] for day in generated["timeline"]["days"] for event in day["events"]]
    assert "Sunset by the river" in titles

    regenerated = client.post(
        f"/api/v1/trips/{trip['id']}/timeline/generate", json={}, headers=auth.headers
    ).json()
    assert regenerated["timeline"]["event_count"] == generated["timeline"]["event_count"]
    manual_again = client.get(f"/api/v1/trips/{trip['id']}/timeline", headers=auth.headers).json()
    manual_ids = [event["id"] for day in manual_again["days"] for event in day["events"]]
    assert manual_event["id"] in manual_ids


def test_event_crud_and_photo_attachment(client, auth, create_trip, upload_photo):
    trip = create_trip(auth.headers)
    photo_id = _upload(
        upload_photo, auth.headers, trip_id=trip["id"], taken_at="2026-10-01T10:00:00"
    )
    other_photo = _upload(
        upload_photo,
        auth.headers,
        trip_id=trip["id"],
        taken_at="2026-10-01T11:00:00",
        colour=(99, 1, 1),
    )

    created = client.post(
        f"/api/v1/trips/{trip['id']}/events",
        json={
            "title": "Temple walk",
            "description": "Quiet morning",
            "event_type": "sightseeing",
            "start_time": "2026-10-01T10:00:00",
            "end_time": "2026-10-01T11:30:00",
            "photo_ids": [photo_id],
        },
        headers=auth.headers,
    )
    assert created.status_code == 201
    event = created.json()
    assert event["source"] == "manual"
    assert event["status"] == "confirmed"
    assert event["day"] == "2026-10-01"
    assert len(event["photos"]) == 1

    attached = client.post(
        f"/api/v1/trips/{trip['id']}/events/{event['id']}/photos",
        json={"photo_ids": [other_photo]},
        headers=auth.headers,
    )
    assert attached.status_code == 200
    assert len(attached.json()["photos"]) == 2

    detached = client.delete(
        f"/api/v1/trips/{trip['id']}/events/{event['id']}/photos/{other_photo}",
        headers=auth.headers,
    )
    assert detached.status_code == 200
    assert len(detached.json()["photos"]) == 1

    updated = client.patch(
        f"/api/v1/trips/{trip['id']}/events/{event['id']}",
        json={"title": "Temple walk at dawn", "status": "draft", "photo_ids": []},
        headers=auth.headers,
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Temple walk at dawn"
    assert updated.json()["status"] == "draft"
    assert updated.json()["photos"] == []

    deleted = client.delete(
        f"/api/v1/trips/{trip['id']}/events/{event['id']}", headers=auth.headers
    )
    assert deleted.status_code == 204
    timeline = client.get(f"/api/v1/trips/{trip['id']}/timeline", headers=auth.headers).json()
    assert timeline["event_count"] == 0


def test_event_validation(client, auth, create_trip):
    trip = create_trip(auth.headers)
    bad_times = client.post(
        f"/api/v1/trips/{trip['id']}/events",
        json={
            "title": "Impossible",
            "start_time": "2026-10-01T12:00:00",
            "end_time": "2026-10-01T10:00:00",
        },
        headers=auth.headers,
    )
    assert bad_times.status_code == 422

    blank_title = client.post(
        f"/api/v1/trips/{trip['id']}/events",
        json={"title": "   ", "start_time": "2026-10-01T12:00:00"},
        headers=auth.headers,
    )
    assert blank_title.status_code == 422

    missing = client.post(
        f"/api/v1/trips/{trip['id']}/events",
        json={"title": "Missing refs", "start_time": "2026-10-01T12:00:00"},
        headers=auth.headers,
    )
    assert missing.status_code == 201


def test_generate_empty_timeline(client, auth, create_trip):
    trip = create_trip(auth.headers)
    response = client.post(
        f"/api/v1/trips/{trip['id']}/timeline/generate", json={}, headers=auth.headers
    )
    assert response.status_code == 200
    assert response.json()["created_events"] == 0
    assert response.json()["timeline"]["days"] == []


def test_timeline_is_private(client, auth, other_auth, create_trip):
    trip = create_trip(auth.headers)
    assert (
        client.get(f"/api/v1/trips/{trip['id']}/timeline", headers=other_auth.headers).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v1/trips/{trip['id']}/timeline/generate",
            json={},
            headers=other_auth.headers,
        ).status_code
        == 404
    )
