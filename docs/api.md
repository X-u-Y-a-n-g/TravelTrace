# API

Base path: **`/api/v1`**

Interactive OpenAPI documentation: **`/api/docs`** · OpenAPI JSON: **`/api/openapi.json`**.

All endpoints return JSON unless they stream a file or a ZIP. Authenticated endpoints require either
`Authorization: Bearer <token>` or the `traveltrace_token` HttpOnly cookie. The bearer header takes
precedence.

## Errors

Every error uses one envelope:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "details": [
      { "field": "email", "message": "value is not a valid email address", "type": "value_error" }
    ]
  }
}
```

| Status | Typical codes |
| --- | --- |
| 400 | `bad_request`, `invalid_bbox`, `empty_file`, `no_files`, `invalid_coordinates` |
| 401 | `not_authenticated`, `invalid_credentials`, `invalid_token`, `token_expired` |
| 403 | `forbidden`, `registration_closed` |
| 404 | `not_found` |
| 409 | `conflict`, `username_taken`, `email_taken`, `place_already_attached`, `task_finished` |
| 413 | `file_too_large` |
| 415 | `unsupported_media_type` |
| 422 | `validation_error`, `unprocessable_entity`, `invalid_dates`, `photo_trip_mismatch` |
| 503 | `geocoding_disabled`, `worker_unavailable` |

## Pagination

List endpoints accept `page` (1-based, default 1) and `size` (default 24, max 100) and return:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "size": 24,
  "pages": 0
}
```

## Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/auth/bootstrap` | Public first-run state (`has_users`, `registration_enabled`, version) |
| POST | `/auth/register` | Create an account and sign in |
| POST | `/auth/login` | Sign in with username **or** email |
| POST | `/auth/logout` | Clear the auth cookie |
| GET | `/auth/me` | Current profile |
| PATCH | `/auth/me` | Update `display_name` |
| POST | `/auth/change-password` | Change password using the current one |

```bash
curl -s http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"demo","password":"traveltrace-demo"}'
```

Response:

```json
{
  "access_token": "eyJ…",
  "token_type": "bearer",
  "expires_in": 604800,
  "user": { "id": "…", "username": "demo", "email": "demo@example.com", "display_name": "Demo Traveller" }
}
```

The response also sets `traveltrace_token` as an HttpOnly cookie. Browsers therefore authenticate
`<img src="/api/v1/photos/{id}/file">` requests without extra code.

## Trips

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/trips` | List trips. Query: `q`, `year`, `visibility`, `sort`, `page`, `size` |
| POST | `/trips` | Create a trip |
| GET | `/trips/{trip_id}` | Trip detail with places, stats and photo previews |
| PATCH | `/trips/{trip_id}` | Update fields or set `cover_photo_id` |
| DELETE | `/trips/{trip_id}` | Soft-delete (archive) the trip |
| POST | `/trips/{trip_id}/restore` | Restore an archived trip |
| GET | `/trips/{trip_id}/export` | Download a portable ZIP (`include_originals=true/false`) |

`sort` values: `start_date_desc` (default), `start_date_asc`, `created_desc`, `created_asc`,
`title_asc`.

Create example:

```json
{
  "title": "Kyoto in Autumn",
  "description": "Temples, bamboo and late-night ramen.",
  "start_date": "2026-10-01",
  "end_date": "2026-10-08",
  "visibility": "private"
}
```

## Trip places (visits)

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/trips/{trip_id}/places` | Ordered visits of a trip |
| POST | `/trips/{trip_id}/places` | Attach a place; optional `arrival_time`, `departure_time`, `sort_order`, `notes` |
| PATCH | `/trips/{trip_id}/places/{visit_id}` | Update times, order or notes |
| DELETE | `/trips/{trip_id}/places/{visit_id}` | Detach the place from the trip |

A place can only be attached once per trip; reuse the visit or edit it instead.

## Places

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/places/categories` | Available category values |
| GET | `/places` | List places. Query: `trip_id`, `category`, `q`, `bbox` (`minLon,minLat,maxLon,maxLat`), `page`, `size` |
| POST | `/places` | Create a reusable place |
| GET | `/places/{place_id}` | Place detail with photo and visit counts |
| PATCH | `/places/{place_id}` | Update a place |
| DELETE | `/places/{place_id}` | Delete a place (visits cascade, photo links are cleared) |
| POST | `/places/geocode` | Reverse geocode `{latitude, longitude}` (requires provider) |

Reverse geocoding is disabled by default and returns `503 geocoding_disabled` until
`TRAVELTRACE_GEOCODING_PROVIDER=nominatim` is configured. Only explicit user-triggered lookups call
the provider.

## Photos

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/photos/upload` | Multipart upload; returns `202 {task_id, uploaded_files}` |
| POST | `/photos/bulk` | Assign a trip/place or set favourite for up to 500 photos |
| GET | `/photos` | List photos with filters |
| GET | `/photos/{photo_id}` | Photo detail |
| PATCH | `/photos/{photo_id}` | Edit trip, place, caption, date, coordinates, favourite |
| DELETE | `/photos/{photo_id}` | Soft-delete the photo |
| GET | `/photos/{photo_id}/file` | Stream `thumb` (default), `preview` or `original` |

List query parameters:

| Parameter | Description |
| --- | --- |
| `trip_id` | Only photos in this trip |
| `unsorted=true` | Only photos without a trip |
| `place_id` | Only photos associated with this place |
| `has_gps=true/false` | Filter by coordinates |
| `favorite=true` | Favourites only |
| `date_from`, `date_to` | Inclusive date range on capture date (`YYYY-MM-DD`) |
| `q` | Filename, caption or camera model |
| `camera` | Camera model substring |
| `sort` | `taken_at_desc` (default), `taken_at_asc`, `created_desc`, `created_asc` |

Upload example:

```bash
curl -s http://localhost:8080/api/v1/photos/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@kyoto.jpg" \
  -F "trip_id=2e7f…"
```

Accepted formats: JPEG, PNG, WebP. Each file is limited by `TRAVELTRACE_MAX_UPLOAD_MB` (25 MB by
default) and at most `TRAVELTRACE_MAX_UPLOAD_FILES` (60) files can be sent at once.

Manual correction example (never changes the original file):

```json
{
  "latitude": 35.0116,
  "longitude": 135.7681,
  "caption": "Corrected by hand"
}
```

## Imports

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/imports` | Same multipart import as `/photos/upload`, returns the task |
| GET | `/imports` | List import tasks (`status`, `trip_id`, pagination) |
| GET | `/imports/{task_id}` | Poll status and progress |
| POST | `/imports/{task_id}/cancel` | Request cancellation between files |

Task shape:

```json
{
  "id": "…",
  "status": "succeeded",
  "progress": 100,
  "total": 3,
  "processed": 3,
  "failed": 0,
  "message": "Imported 3 photos",
  "result": { "imported": 3, "skipped": 0, "failed": 0, "photo_ids": ["…"] }
}
```

Statuses: `queued` → `running` → `succeeded` | `partial` | `failed` | `cancelled`.

## Timeline

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/trips/{trip_id}/timeline` | Events grouped by day |
| POST | `/trips/{trip_id}/timeline/generate` | Generate draft events; optional tuning |
| POST | `/trips/{trip_id}/events` | Create a manual event |
| PATCH | `/trips/{trip_id}/events/{event_id}` | Update title, times, place, type, status, photos |
| DELETE | `/trips/{trip_id}/events/{event_id}` | Delete an event |
| POST | `/trips/{trip_id}/events/{event_id}/photos` | Attach photos |
| DELETE | `/trips/{trip_id}/events/{event_id}/photos/{photo_id}` | Detach a photo |

Generation request (all fields optional):

```json
{
  "max_gap_minutes": 180,
  "max_distance_km": 3.0,
  "replace_auto": true
}
```

Generation removes previous **auto** events (unless `replace_auto=false`) and never touches manual or
confirmed events. Photos inside manual/confirmed events are excluded from the new clusters.

Confirm a draft:

```json
{ "status": "confirmed" }
```

Timeline response:

```json
{
  "trip_id": "…",
  "start_date": "2026-10-01",
  "end_date": "2026-10-08",
  "days": [
    {
      "date": "2026-10-02",
      "day_index": 2,
      "events": [
        {
          "id": "…",
          "title": "Kiyomizu-dera",
          "event_type": "sightseeing",
          "start_time": "2026-10-02T09:20:00",
          "end_time": "2026-10-02T09:20:00",
          "day": "2026-10-02",
          "source": "auto",
          "status": "draft",
          "place": { "id": "…", "name": "Kiyomizu-dera", "category": "attraction" },
          "photos": []
        }
      ]
    }
  ],
  "event_count": 1,
  "photo_count": 1
}
```

## Map

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/map/markers` | Photo and place markers with optional filters |
| GET | `/map/routes` | GeoJSON `FeatureCollection` of trip routes |

`/map/markers` query parameters:

- `trip_id` — a single trip, or `trip_ids` — comma-separated trip ids.
- `bbox=minLon,minLat,maxLon,maxLat` — viewport filter.
- `date_from`, `date_to` — photo capture dates.
- `categories` — comma-separated place categories (also filters photo markers to associated places).
- `limit` — default 2000, max 5000.

Each marker contains `kind` (`photo` or `place`), coordinates, title/subtitle, ids, trip context and
timestamp. The client clusters photo markers with MapLibre's GeoJSON cluster support.

Routes prefer the ordered trip visits; if a trip has fewer than two mapped places, the route falls
back to that trip's geotagged photos in capture order.

## Dashboard and settings

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/stats/overview` | Totals, year breakdown, country details, recent trips/photos |
| GET | `/settings` | Instance version, limits, storage usage, feature flags |
| GET | `/health` | Liveness/readiness with database status |

## Export format

`GET /trips/{trip_id}/export` returns a ZIP with:

```
manifest.json     # format version, app version, counts, exported-at
trip.json         # trip record plus statistics
timeline.json     # days and events (photo metadata inlined)
places.geojson    # RFC 7946 FeatureCollection of visits
photos.json       # photo metadata with relative file paths
photos/           # original JPEG/PNG/WebP files (optional)
README.txt        # human-readable explanation
```

Use `include_originals=false` for a metadata-only archive.

## Date and time conventions

- `taken_at`, `start_time`, `end_time`, `arrival_time` are camera-local wall-clock values without a
  timezone suffix.
- `created_at`, `updated_at`, `last_login_at`, `started_at`, `finished_at` are UTC timestamps with an
  offset.
- Send dates for filters as `YYYY-MM-DD`.

## Not implemented in v0.1.0

- GPX/GeoJSON/KML track import, track-to-photo matching.
- Journals and memory-book generation.
- Public sharing endpoints (visibility is stored, public pages arrive with v0.3.0).
- Password reset, email verification, rate limiting, API keys.
- S3 storage and multi-device sync.
