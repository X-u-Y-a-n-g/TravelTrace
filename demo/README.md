# Demo dataset

This folder contains a small, reproducible demo of TravelTrace:

- `photos/` — twelve freely licensed travel photographs with EXIF capture time, GPS and camera data.
- `ATTRIBUTION.md` — author, license and source for every photograph.
- `seed.py` — creates the demo account, three trips, twelve places, uploads the photos and generates
  draft timelines.

## Run it

The script talks to a running TravelTrace instance and requires a **fresh database**:

```bash
python -m pip install httpx
python demo/seed.py --api http://localhost:8080/api/v1
```

| Field | Value |
| --- | --- |
| Username | `demo` |
| Password | `traveltrace-demo` |
| Email | `demo@example.com` |

The script exits if the demo trips already exist, so it is safe to keep it in a Makefile or a
provisioning script. To start over, recreate the database volume (or `backend/data/traveltrace.db`
in local development) and run it again.

If you use the Docker stack, the API is reachable through nginx on port 8080. For local development
the default is <http://127.0.0.1:8000/api/v1>.

## What gets created

| Trip | Dates | Photos | Places |
| --- | --- | --- | --- |
| Kyoto in Autumn | 2026-10-01 → 2026-10-08 | 5 | Kiyomizu-dera, Fushimi Inari, Gion, Arashiyama, Nara Park |
| Lisbon & the Atlantic | 2025-05-12 → 2025-05-19 | 4 | Belém Tower, Alfama, Pena Palace, Cabo da Roca |
| Norwegian Fjords | 2024-06-20 → 2024-06-27 | 3 | Geirangerfjord, Bryggen, Trolltunga |

Each trip gets a cover photo, favourites, captions, ordered visits and a generated draft timeline
(12 draft events in total). One first event is left unconfirmed intentionally so the "Looks right"
flow is visible.

## Photographs

The images are licensed under Creative Commons or public-domain terms. Attribution is required for
some of them; see [ATTRIBUTION.md](ATTRIBUTION.md) before redistributing the demo images. They are
included only to make the demo self-contained — they are not part of the application runtime.

To regenerate the photos (maintainers only), run a Commons search, download the selected files,
re-encode them and write the EXIF fields. The generated images in this repository already contain
the required metadata, so no network access is needed to seed the demo.

## Public instances

Do not seed the demo on a publicly reachable instance. The account uses a well-known password and
would expose sample content to anyone. It is intended for local evaluation and screenshots.
