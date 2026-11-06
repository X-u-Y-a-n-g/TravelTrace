# Changelog

All notable changes to TravelTrace are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Planned

- GPX / GeoJSON / KML import and track-to-photo matching (v0.4.0).
- Journals, memory books and HTML/PDF export (v0.5.0).

## [0.3.0] — 2026-11-06

The single-machine release: the desktop app packages the backend, database and photos into one
Windows EXE, and the Android app stores everything locally without a server.

### Added

- **Windows desktop EXE** — PyInstaller + pywebview shell that runs FastAPI, SQLite and local photo
  storage in-process and opens a native window. No Docker, PostgreSQL or separate server needed.
- **Existing data import** — the desktop app detects `backend/data` / `.cache/devdata`, prompts to
  import the SQLite database and uploads folder, and can also do it with
  `--import-data <path>`. Existing accounts keep working.
- **Android offline mode** — a full IndexedDB data layer for trips, places, photos, EXIF metadata,
  thumbnails, timeline events, map markers, statistics and settings. No server address, account or
  network setup is required.
- **Local photo pipeline** — client-side EXIF reading (`exifr`), SHA-256 deduplication, canvas
  thumbnails/previews, automatic trip/place matching and draft timeline generation.
- **Offline ZIP export** — exports trip metadata, timeline, GeoJSON and originals with JSZip; on
  Android the ZIP is written to the cache and opened with the system share sheet.
- **Desktop/Android CI** — GitHub Actions builds the Windows EXE and Android debug APK artifacts.

### Changed

- Version bumped to `0.3.0` across the backend, frontend, Android project, OpenAPI document and
  documentation.
- Android no longer asks for a server address; it opens directly into the local journal.
- Settings shows local storage details instead of a server address on Android.
- Roadmap: GPX/KML reconstruction moves to v0.4.0 and journals/memory books to v0.5.0.

## [0.2.0] — 2026-11-06

The first mobile release: an Android client built with Capacitor, connected to the same self-hosted
API and UI.

### Added

- **Android app** — Capacitor shell with app icon, splash screen, status bar handling, hardware back
  navigation and the full React interface bundled in the APK.
- **Mobile server setup** — first launch asks for the self-hosted TravelTrace address, validates
  `/api/v1/health`, remembers it and supports changing it from the login footer or Settings.
- **Mobile media auth** — photo files and ZIP exports accept a JWT `access_token` query parameter so
  WebView image tags and downloads work across origins. JSON API calls keep using bearer auth.
- **Native link handling** — external links and downloads open in the system browser.
- **Android CI** — GitHub Actions builds a debug APK on every push and uploads it as an artifact.
- A prebuilt debug APK is included under [`mobile/`](mobile/) with build and install instructions.
- Docker Compose and backend CORS defaults now allow the Capacitor origins (`http://localhost`,
  `https://localhost`, `capacitor://localhost`).

### Changed

- Version bumped to `0.2.0` across the backend, frontend, Android project, OpenAPI document and
  documentation.
- Roadmap: GPX/KML reconstruction moves to v0.3.0 and journals/memory books to v0.4.0.

## [0.1.1] — 2026-11-06

A bilingual patch release: the whole interface is now available in Chinese and English, with Chinese
as the default.

### Added

- **Chinese and English UI** — every page, dialog, empty state, validation message and toast has been
  translated. Dates, date ranges and weekday labels follow the selected locale.
- **Language switcher** — available on the login page, in the sidebar, in the mobile header and on the
  Settings page. The choice is stored in the browser and survives reloads.
- **Bilingual screenshots** — README images are captured in both languages under
  `docs/screenshots/zh` and `docs/screenshots/en`.

### Changed

- Chinese is the default language for first-time visitors, regardless of browser locale.
- Version bumped to `0.1.1` across the backend, frontend, OpenAPI document and documentation.
- E2E coverage now verifies the Chinese default, the language switch and persistence.

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
