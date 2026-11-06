# Changelog

All notable changes to TravelTrace are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Planned

- GPX / GeoJSON / KML import and track-to-photo matching (v0.2.0).
- Journals, memory books and HTML/PDF export (v0.3.0).

## [0.1.0] — 2026-11-05

The first public MVP: upload photos, reconstruct the map and timeline, edit the results, export
everything.

### Added

- **Trips** — CRUD with dates, description, cover photo, visibility, soft delete and restore.
- **Photo import** — batch upload, SHA-256 de-duplication, EXIF capture time/GPS/camera/lens,
  previews and EXIF-free thumbnails, per-file error isolation, progress and cancellation.
- **Photo library** — filters (trip, GPS, favourites, dates, search, camera), sorting, pagination,
  bulk trip assignment, manual coordinate correction with an interactive map picker.
- **Places** — reusable places, categories, addresses, visit times and notes; automatic nearby-place
  matching on import.
- **Map** — clustered photo markers with counts, place markers, category/trip filters, GeoJSON route
  lines, session detail panels.
- **Timeline** — rule-based clustering into draft events, place-derived titles, manual events,
  attach/detach photos, confirm drafts, regeneration that preserves manual work.
- **Dashboard** — journeys, countries, cities, places, photos, days, storage, yearly rhythm, recent
  trips and photos, world footprint map.
- **Data export** — per-trip ZIP with JSON, GeoJSON, timeline, photo metadata and originals.
- **Authentication** — registration, login by username or email, JWT + HttpOnly cookie, profile and
  password changes, first-run bootstrap state.
- **Deployment** — Docker Compose stack with PostgreSQL/PostGIS, Redis, Celery worker, nginx,
  health checks and automatic Alembic migrations.
- **Privacy** — private-by-default trips, authenticated files, EXIF stripping in derivatives,
  disabled-by-default geocoding, per-user deduplication.
- **Developer experience** — Pytest suite (SQLite + opt-in PostGIS), Vitest unit tests, Playwright
  E2E, seeded demo dataset, architecture/database/API/deployment documentation, CI workflows.

### Notes

- The schema includes forward-looking tables for tracks, journals and memory books; their APIs arrive
  in later releases.
- SQLite is supported for development and tests; PostgreSQL + PostGIS is required for deployment.
- HEIC/HEIF is not accepted in this release.
- No password reset, email verification, rate limiting or 2FA yet.
