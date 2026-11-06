#!/usr/bin/env python3
"""Seed a TravelTrace instance with a small, realistic demo journal.

Usage:
    python demo/seed.py --api http://127.0.0.1:8000/api/v1

The script creates the demo account (demo / traveltrace-demo), three trips,
visited places and a set of CC-licensed photos bundled in demo/photos, then
generates a draft timeline for each trip. It refuses to run twice on the same
database to avoid duplicates.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import httpx

TERMINAL = {"succeeded", "partial", "failed", "cancelled"}

TRIPS = [
    {
        "title": "Kyoto in Autumn",
        "description": "Eight days of temples, bamboo and late-night ramen. The maples were just turning.",
        "start_date": "2026-10-01",
        "end_date": "2026-10-08",
        "places": [
            {
                "name": "Kiyomizu-dera",
                "category": "attraction",
                "address": "1-294 Kiyomizu, Higashiyama Ward, Kyoto",
                "city": "Kyoto",
                "region": "Kyoto",
                "country": "Japan",
                "country_code": "JP",
                "latitude": 34.994856,
                "longitude": 135.785046,
                "notes": "Go before 8am to have the wooden stage almost to yourself.",
                "arrival": "2026-10-02T09:00:00",
            },
            {
                "name": "Fushimi Inari Taisha",
                "category": "attraction",
                "address": "68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto",
                "city": "Kyoto",
                "region": "Kyoto",
                "country": "Japan",
                "country_code": "JP",
                "latitude": 34.967140,
                "longitude": 135.772684,
                "notes": "We walked to the summit and back in three hours.",
                "arrival": "2026-10-02T13:30:00",
            },
            {
                "name": "Gion",
                "category": "attraction",
                "address": "Gion, Higashiyama Ward, Kyoto",
                "city": "Kyoto",
                "region": "Kyoto",
                "country": "Japan",
                "country_code": "JP",
                "latitude": 35.003700,
                "longitude": 135.778800,
                "notes": "Lanterns on Shinbashi-dori after sunset.",
                "arrival": "2026-10-02T18:00:00",
            },
            {
                "name": "Arashiyama Bamboo Grove",
                "category": "nature",
                "address": "Sagaogurayama Tabuchiyamacho, Ukyo Ward, Kyoto",
                "city": "Kyoto",
                "region": "Kyoto",
                "country": "Japan",
                "country_code": "JP",
                "latitude": 35.017000,
                "longitude": 135.671000,
                "notes": "Short walk, but the light between the stalks is unreal.",
                "arrival": "2026-10-03T08:00:00",
            },
            {
                "name": "Nara Park",
                "category": "nature",
                "address": "Nara, Nara Prefecture",
                "city": "Nara",
                "region": "Nara",
                "country": "Japan",
                "country_code": "JP",
                "latitude": 34.685100,
                "longitude": 135.804800,
                "notes": "Deer bowing for crackers under the first red leaves.",
                "arrival": "2026-10-04T11:00:00",
            },
        ],
        "photos": [
            {
                "file": "kyoto-kiyomizu.jpg",
                "caption": "Morning light on the wooden stage.",
                "favorite": True,
            },
            {"file": "kyoto-fushimi.jpg", "caption": "A thousand gates, and still counting."},
            {"file": "kyoto-gion.jpg", "caption": "Lanterns and quiet footsteps in Gion."},
            {"file": "kyoto-arashiyama.jpg", "caption": "Bamboo light.", "favorite": True},
            {"file": "nara-deer.jpg", "caption": "The deer of Nara Park."},
        ],
    },
    {
        "title": "Lisbon & the Atlantic",
        "description": "Tiled streets, custard tarts and the edge of Europe.",
        "start_date": "2025-05-12",
        "end_date": "2025-05-19",
        "places": [
            {
                "name": "Belém Tower",
                "category": "attraction",
                "address": "Av. Brasília, 1400-038 Lisboa",
                "city": "Lisbon",
                "region": "Lisbon",
                "country": "Portugal",
                "country_code": "PT",
                "latitude": 38.691600,
                "longitude": -9.216000,
                "notes": "Queued for the tower — worth it for the view over the Tagus.",
                "arrival": "2025-05-13T10:00:00",
            },
            {
                "name": "Alfama",
                "category": "attraction",
                "address": "Alfama, Lisbon",
                "city": "Lisbon",
                "region": "Lisbon",
                "country": "Portugal",
                "country_code": "PT",
                "latitude": 38.711000,
                "longitude": -9.130000,
                "notes": "Tram 28, steep alleys and fado drifting out of doorways.",
                "arrival": "2025-05-13T16:00:00",
            },
            {
                "name": "Pena Palace",
                "category": "attraction",
                "address": "Estrada da Pena, 2710-609 Sintra",
                "city": "Sintra",
                "region": "Lisbon",
                "country": "Portugal",
                "country_code": "PT",
                "latitude": 38.787600,
                "longitude": -9.390400,
                "notes": "Colourful palace above the clouds.",
                "arrival": "2025-05-14T10:30:00",
            },
            {
                "name": "Cabo da Roca",
                "category": "nature",
                "address": "Estrada do Cabo da Roca, Colares",
                "city": "Colares",
                "region": "Lisbon",
                "country": "Portugal",
                "country_code": "PT",
                "latitude": 38.780500,
                "longitude": -9.498900,
                "notes": "The westernmost point of mainland Europe. Windy and unforgettable.",
                "arrival": "2025-05-15T17:00:00",
            },
        ],
        "photos": [
            {"file": "lisbon-belem.jpg", "caption": "Belém Tower on a clear morning.", "favorite": True},
            {"file": "lisbon-alfama.jpg", "caption": "Tram 28 climbing through Alfama."},
            {"file": "sintra-pena.jpg", "caption": "Pena Palace in the mist."},
            {"file": "cabo-da-roca.jpg", "caption": "Where the land ends.", "favorite": True},
        ],
    },
    {
        "title": "Norwegian Fjords",
        "description": "Slow boats, steep valleys and weather that changes every hour.",
        "start_date": "2024-06-20",
        "end_date": "2024-06-27",
        "places": [
            {
                "name": "Geirangerfjord",
                "category": "nature",
                "address": "Geiranger, Møre og Romsdal",
                "city": "Geiranger",
                "region": "Møre og Romsdal",
                "country": "Norway",
                "country_code": "NO",
                "latitude": 62.101000,
                "longitude": 7.206500,
                "notes": "Viewed from Flydalsjuvet after the rain.",
                "arrival": "2024-06-22T09:30:00",
            },
            {
                "name": "Bryggen",
                "category": "attraction",
                "address": "Bryggen, Bergen",
                "city": "Bergen",
                "region": "Vestland",
                "country": "Norway",
                "country_code": "NO",
                "latitude": 60.397000,
                "longitude": 5.324000,
                "notes": "Wooden warehouses and fish soup by the harbour.",
                "arrival": "2024-06-24T15:00:00",
            },
            {
                "name": "Trolltunga",
                "category": "nature",
                "address": "Odda, Vestland",
                "city": "Odda",
                "region": "Vestland",
                "country": "Norway",
                "country_code": "NO",
                "latitude": 60.124000,
                "longitude": 6.740000,
                "notes": "A long hike, low clouds, and a view that kept opening up.",
                "arrival": "2024-06-26T09:00:00",
            },
        ],
        "photos": [
            {"file": "geirangerfjord.jpg", "caption": "The fjord from above.", "favorite": True},
            {"file": "bryggen.jpg", "caption": "Bryggen in the afternoon."},
            {"file": "trolltunga.jpg", "caption": "Clouds over the valley."},
        ],
    },
]


class SeedError(RuntimeError):
    pass


def check(response: httpx.Response, context: str) -> dict | list:
    if response.status_code >= 400:
        raise SeedError(f"{context}: HTTP {response.status_code} — {response.text[:300]}")
    return response.json()


def wait_for_task(client: httpx.Client, headers: dict, task_id: str) -> dict:
    deadline = time.time() + 180
    while time.time() < deadline:
        task = check(client.get(f"/imports/{task_id}", headers=headers), "import status")
        if task["status"] in TERMINAL:
            return task
        time.sleep(0.4)
    raise SeedError(f"Import task {task_id} timed out")


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed TravelTrace with demo data")
    parser.add_argument("--api", default="http://127.0.0.1:8000/api/v1")
    parser.add_argument("--photos-dir", default=str(Path(__file__).parent / "photos"))
    parser.add_argument("--username", default="demo")
    parser.add_argument("--email", default="demo@example.com")
    parser.add_argument("--password", default="traveltrace-demo")
    args = parser.parse_args()

    photos_dir = Path(args.photos_dir)
    missing = [photo["file"] for trip in TRIPS for photo in trip["photos"] if not (photos_dir / photo["file"]).is_file()]
    if missing:
        print(f"Missing demo photos: {', '.join(missing)}", file=sys.stderr)
        return 2

    client = httpx.Client(base_url=args.api.rstrip("/"), timeout=120, follow_redirects=True)
    register = client.post(
        "/auth/register",
        json={
            "username": args.username,
            "email": args.email,
            "password": args.password,
            "display_name": "Demo Traveller",
        },
    )
    if register.status_code == 409:
        login = client.post(
            "/auth/login", json={"identifier": args.username, "password": args.password}
        )
        if login.status_code != 200:
            print(
                "A user already exists but the demo password does not match. "
                "Point the script at a fresh database or pass --username/--password.",
                file=sys.stderr,
            )
            return 1
        token = login.json()["access_token"]
        print("Using the existing demo account.")
    else:
        token = check(register, "register demo user")["access_token"]
        print("Created the demo account.")

    headers = {"Authorization": f"Bearer {token}"}

    existing = check(client.get("/trips", params={"size": 100}, headers=headers), "list trips")
    existing_titles = {trip["title"] for trip in existing["items"]}
    if any(trip["title"] in existing_titles for trip in TRIPS):
        print(
            "Demo trips already exist on this instance. Use a fresh database to reseed.",
            file=sys.stderr,
        )
        return 1

    for trip_data in TRIPS:
        trip = check(
            client.post(
                "/trips",
                headers=headers,
                json={
                    "title": trip_data["title"],
                    "description": trip_data["description"],
                    "start_date": trip_data["start_date"],
                    "end_date": trip_data["end_date"],
                    "visibility": "private",
                },
            ),
            f"create trip {trip_data['title']}",
        )
        print(f"\n{trip['title']} — {trip['id']}")

        for index, place_data in enumerate(trip_data["places"], start=1):
            payload = {key: value for key, value in place_data.items() if key != "arrival"}
            place = check(client.post("/places", headers=headers, json=payload), "create place")
            check(
                client.post(
                    f"/trips/{trip['id']}/places",
                    headers=headers,
                    json={
                        "place_id": place["id"],
                        "arrival_time": place_data["arrival"],
                        "sort_order": index,
                    },
                ),
                f"attach place {place['name']}",
            )
            print(f"  + {place['name']}")

        photo_ids: dict[str, str] = {}
        for photo in trip_data["photos"]:
            path = photos_dir / photo["file"]
            response = client.post(
                "/photos/upload",
                headers=headers,
                files={"files": (path.name, path.read_bytes(), "image/jpeg")},
                data={"trip_id": trip["id"]},
            )
            task_id = check(response, f"upload {path.name}")["task_id"]
            task = wait_for_task(client, headers, task_id)
            if task["status"] not in {"succeeded", "partial"} or not task["result"].get("photo_ids"):
                raise SeedError(f"Import failed for {path.name}: {task.get('error') or task.get('message')}")
            photo_id = task["result"]["photo_ids"][0]
            photo_ids[photo["file"]] = photo_id
            patch = {"caption": photo.get("caption")}
            if photo.get("favorite"):
                patch["is_favorite"] = True
            check(
                client.patch(f"/photos/{photo_id}", headers=headers, json=patch),
                f"update photo {path.name}",
            )
            print(f"  · {path.name}")

        cover = photo_ids.get(trip_data["photos"][0]["file"])
        if cover:
            check(
                client.patch(
                    f"/trips/{trip['id']}", headers=headers, json={"cover_photo_id": cover}
                ),
                "set cover",
            )

        generated = check(
            client.post(f"/trips/{trip['id']}/timeline/generate", headers=headers, json={}),
            "generate timeline",
        )
        print(
            f"  timeline: {generated['created_events']} draft events, "
            f"{generated['assigned_photos']} photos"
        )

    print("\nDemo data ready.")
    print(f"  URL:      http://localhost:5173 (or your deployment URL)")
    print(f"  Username: {args.username}")
    print(f"  Password: {args.password}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SeedError as error:
        print(f"Seed failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
