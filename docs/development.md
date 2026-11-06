# Development

## Requirements

| Tool | Version | Notes |
| --- | --- | --- |
| Python | 3.10+ | 3.12 recommended |
| Node.js | 20+ | 22 recommended |
| npm | 10+ | Comes with Node |
| Git | any recent | |
| Docker + Compose | optional | For PostgreSQL/PostGIS/Redis or the full stack |
| ExifTool | optional | Improves metadata coverage; Pillow is the baseline |

On Windows, use PowerShell and the `.venv\Scripts\…` paths shown below.

## Clone and configure

```bash
git clone https://github.com/X-u-Y-a-N-g/TravelTrace.git
cd TravelTrace
```

The backend reads settings from environment variables prefixed with `TRAVELTRACE_`, optionally from
`backend/.env` or the repository-root `.env`. Without configuration it uses SQLite and local disk
storage, so no external services are required for development.

## Backend

```bash
python -m venv .venv
# Windows
.venv\Scripts\Activate.ps1
# macOS/Linux
source .venv/bin/activate

pip install -e "backend[dev]"

cd backend
uvicorn app.main:app --reload --port 8000
```

On first start the app creates `backend/data/traveltrace.db`, the uploads directory and a persisted
JWT secret. Tables are created automatically for SQLite (`TRAVELTRACE_AUTO_CREATE_TABLES=true`). In
production, run migrations explicitly:

```bash
cd backend
alembic upgrade head
```

API: <http://127.0.0.1:8000/api/v1/health> · Docs: <http://127.0.0.1:8000/api/docs>.

### Optional: PostgreSQL and Redis

```bash
docker run --name traveltrace-pg -d \
  -e POSTGRES_PASSWORD=traveltrace -e POSTGRES_DB=traveltrace \
  -p 5432:5432 postgis/postgis:16-3.4

docker run --name traveltrace-redis -d -p 6379:6379 redis:7-alpine
```

```bash
export TRAVELTRACE_DATABASE_URL="postgresql+psycopg://traveltrace:traveltrace@localhost:5432/traveltrace"
cd backend
alembic upgrade head
```

The same database URL must be used by the API and any Celery worker.

### Optional: Celery worker

```bash
# terminal 1 — API
export TRAVELTRACE_TASK_BACKEND=celery
export TRAVELTRACE_CELERY_BROKER_URL=redis://localhost:6379/0
cd backend && uvicorn app.main:app --reload --port 8000

# terminal 2 — worker
export TRAVELTRACE_TASK_BACKEND=celery
export TRAVELTRACE_CELERY_BROKER_URL=redis://localhost:6379/0
cd backend && celery -A app.tasks.celery_app.celery_app worker --loglevel=INFO --concurrency=2
```

Both processes must see the same `TRAVELTRACE_STORAGE_DIR` (the worker moves files and writes
derivatives).

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` to <http://127.0.0.1:8000> by default; override with
`VITE_API_PROXY`.

Useful scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check and production build to `dist/` |
| `npm run preview` | Serve the production build on port 4173 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run e2e` | Playwright end-to-end tests |

### Map style

The default style is OpenFreeMap Positron. Set `VITE_MAP_STYLE_URL` to any MapLibre style JSON (for
example your own tile server) when building:

```bash
VITE_MAP_STYLE_URL=https://your-tiles.example.com/style.json npm run build
```

The browser needs WebGL and network access to the style's tiles/glyphs. A style outage shows a
non-blocking hint; the rest of the application keeps working.

## Environment variables

All backend settings live in [`backend/app/core/config.py`](../backend/app/core/config.py). The
commonly changed ones:

| Variable | Default | Description |
| --- | --- | --- |
| `TRAVELTRACE_ENVIRONMENT` | `development` | `development`, `test`, `production` |
| `TRAVELTRACE_DATABASE_URL` | SQLite in `backend/data/` | SQLAlchemy URL |
| `TRAVELTRACE_SECRET_KEY` | generated | JWT signing key |
| `TRAVELTRACE_STORAGE_DIR` | `backend/data/uploads` | Originals and derivatives |
| `TRAVELTRACE_AUTO_CREATE_TABLES` | `true` | `create_all` on startup; disable in production |
| `TRAVELTRACE_ALLOW_REGISTRATION` | `true` | Close open sign-ups |
| `TRAVELTRACE_TASK_BACKEND` | `thread` | `inline`, `thread`, `celery` |
| `TRAVELTRACE_CELERY_BROKER_URL` | `redis://localhost:6379/0` | Broker |
| `TRAVELTRACE_MAX_UPLOAD_MB` | `25` | Per-photo limit |
| `TRAVELTRACE_MAX_UPLOAD_FILES` | `60` | Files per request |
| `TRAVELTRACE_GEOCODING_PROVIDER` | `none` | `nominatim` enables reverse geocoding |
| `TRAVELTRACE_GEOCODING_URL` | `https://nominatim.openstreetmap.org` | Provider base URL |
| `TRAVELTRACE_GEOCODING_USER_AGENT` | `TravelTrace/0.1 (self-hosted)` | Required by Nominatim |
| `TRAVELTRACE_EXIFTOOL_ENABLED` | `true` | Use ExifTool when installed |
| `TRAVELTRACE_CORS_ORIGINS` | localhost:5173/4173/8080 | Comma-separated origins |
| `TRAVELTRACE_THUMBNAIL_PX` | `640` | Thumbnail longest edge |
| `TRAVELTRACE_PREVIEW_PX` | `1600` | Preview longest edge |

Frontend build variables: `VITE_API_BASE` (default `/api/v1`), `VITE_MAP_STYLE_URL`.

## Tests

### Backend

```bash
# from the repository root, with .venv active
python -m pytest
```

- The suite uses an isolated SQLite database in a temporary directory, so it is safe to run at any
  time.
- `tests/backend/test_postgres.py` is skipped unless `TRAVELTRACE_TEST_DATABASE_URL` points at a
  disposable PostgreSQL + PostGIS database. It verifies the geography column, SRID, GIST index and
  SQL round-trip.
- Coverage: `python -m pytest --cov=backend/app --cov-report=term-missing`.

### Frontend

```bash
cd frontend
npm run test          # Vitest + Testing Library
npm run lint
npm run typecheck
npm run build
```

### End-to-end

The E2E suite needs a running API and frontend:

```bash
# terminal 1 — API with an isolated database
cd backend
TRAVELTRACE_DATABASE_URL="sqlite:///$PWD/e2e.db" \
TRAVELTRACE_STORAGE_DIR="$PWD/e2e-uploads" \
TRAVELTRACE_TASK_BACKEND=inline \
TRAVELTRACE_SECRET_KEY=e2e-secret \
uvicorn app.main:app --port 8000

# terminal 2 — built frontend
cd frontend
npm run build
npm run preview -- --host 127.0.0.1 --port 4173

# terminal 3
cd frontend
npx playwright install chromium
npx playwright test
```

- Playwright installs its own Chromium by default. To use an installed browser instead, set
  `E2E_CHANNEL=chrome` (or `msedge`).
- `E2E_BASE_URL` overrides <http://127.0.0.1:4173>.
- Failures produce a trace and screenshot under `test-results/`.

## Demo data and screenshots

```bash
python demo/seed.py --api http://127.0.0.1:8000/api/v1
```

Requires `httpx` (already installed with the backend) and a **fresh** database. Credentials:
`demo` / `traveltrace-demo`. Re-running is refused if the demo trips already exist.

To regenerate the README screenshots against a running seeded instance:

```bash
cd frontend
E2E_CHANNEL=chrome node scripts/screenshots.mjs
```

The dashboard is captured at <http://127.0.0.1:4173> by default (`E2E_BASE_URL` to change).

## Code conventions

### Backend

- Python 3.10+, SQLAlchemy 2.0 typed mappings, Pydantic v2.
- Keep HTTP concerns in `api/`, business logic in `services/`, queries in `repositories/`, image and
  spatial logic in `processors/`. See [architecture.md](architecture.md).
- Raise `AppError` subclasses from `app.core.errors`; never return ad-hoc error dictionaries.
- Create and commit transactions in services; routers do not commit.
- Add tests for every new endpoint, permission rule and algorithm edge case.
- Run `ruff check .` and `ruff format .` from the repository root.

### Frontend

- TypeScript strict mode; no `any` unless interfacing with a library boundary.
- Server data goes through TanStack Query; do not copy API responses into component state except for
  forms.
- Use the existing UI primitives in `components/ui` and design tokens in `tailwind.config.ts`.
- Every page must work at 390 px width and with keyboard navigation.
- Add unit tests for pure helpers and critical components; add an E2E flow for new user journeys.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `database is locked` (SQLite) | Only use one process with SQLite; prefer PostgreSQL for API + worker |
| Login works but images return 401 | Cookies blocked; check the request scheme and that `/api` is same-origin |
| Browser console CORS errors | Add the frontend origin to `TRAVELTRACE_CORS_ORIGINS` |
| Map is blank | WebGL disabled or the style URL cannot load; check the network tab |
| Upload returns 413 | Raise nginx `client_max_body_size` and `TRAVELTRACE_MAX_UPLOAD_MB` |
| Import task stays `queued` | Celery worker not running or Redis unreachable |
| `geocoding_disabled` | Set `TRAVELTRACE_GEOCODING_PROVIDER=nominatim` |
| PostGIS test skipped | Set `TRAVELTRACE_TEST_DATABASE_URL` to a disposable PostGIS database |
| Playwright browser missing | `npx playwright install chromium` |
| Demo seed refuses to run | The demo trips already exist; use a fresh database |

Windows paths in `TRAVELTRACE_DATABASE_URL` should use forward slashes, e.g.
`sqlite:///E:/activity/TravelTrace/data/traveltrace.db`.
