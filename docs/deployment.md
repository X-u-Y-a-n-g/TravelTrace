# Deployment

TravelTrace v0.1.1 ships as a Docker Compose stack: nginx + React, FastAPI, a Celery worker,
PostgreSQL 16 with PostGIS 3.4, and Redis 7.

## Requirements

- Docker Engine 24+ with the Compose plugin (Docker Desktop on Windows/macOS works).
- 2 vCPU and 2 GB RAM minimum; 4 GB recommended for large photo batches.
- Disk space for originals plus roughly 15–25% extra for previews and thumbnails.
- A domain and TLS certificate for anything reachable from the internet.

## Quick deploy

```bash
git clone https://github.com/X-u-Y-a-N-g/TravelTrace.git
cd TravelTrace
cp .env.example .env
```

Edit `.env`:

```dotenv
POSTGRES_PASSWORD=<long random string>
TRAVELTRACE_SECRET_KEY=<openssl rand -hex 32>
TRAVELTRACE_PORT=8080
```

Start:

```bash
docker compose up -d --build
docker compose ps
```

Open **http://localhost:8080** and create the first account.

The first start may take a few minutes while images build and the database initialises. The backend
waits for PostgreSQL, runs `alembic upgrade head`, then starts Uvicorn. The frontend container waits
for the backend health check.

### Services

| Service | Internal | Published | Notes |
| --- | --- | --- | --- |
| `frontend` | 80 | `${TRAVELTRACE_PORT}` (8080) | nginx, static SPA + `/api` proxy |
| `backend` | 8000 | — | FastAPI; not exposed by default |
| `worker` | — | — | Celery; shares the uploads volume |
| `db` | 5432 | — | PostgreSQL + PostGIS |
| `redis` | 6379 | — | Broker/result backend |

Only the frontend port should be reachable from outside. To debug the API directly, uncomment the
`ports` entry for `backend` in `docker-compose.yml`.

## Configuration

Environment variables are read from `.env` by Compose and passed to the backend. The full list lives in
[`backend/app/core/config.py`](../backend/app/core/config.py) and [development.md](development.md#environment-variables).

| Variable | Default | Production advice |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | `traveltrace` | Generate a long random value |
| `TRAVELTRACE_SECRET_KEY` | placeholder | Generate with `openssl rand -hex 32`; changing it signs everyone out |
| `TRAVELTRACE_PORT` | `8080` | Any free host port; put TLS in front |
| `TRAVELTRACE_ALLOW_REGISTRATION` | `true` | Set to `false` after creating your accounts |
| `TRAVELTRACE_TASK_BACKEND` | `celery` | Keep `celery` with the bundled worker |
| `TRAVELTRACE_GEOCODING_PROVIDER` | `none` | Enable only if you accept the provider's terms |
| `VITE_MAP_STYLE_URL` | OpenFreeMap Positron | Use your own style/tiles for production traffic |

### Map and geocoding providers

- The default map style uses OpenFreeMap and OpenStreetMap data. **Attribution is required** and
  public services are not unlimited production infrastructure. For real traffic, point
  `VITE_MAP_STYLE_URL` at your own style (for example a self-hosted tile server or a commercial
  provider).
- Reverse geocoding is opt-in. Nominatim's public endpoint has a strict usage policy and requires a
  descriptive `User-Agent`; set `TRAVELTRACE_GEOCODING_USER_AGENT` to your contact and consider a
  self-hosted or commercial provider for heavy use.

Changing `VITE_MAP_STYLE_URL` requires rebuilding the frontend image:

```bash
docker compose build frontend
docker compose up -d frontend
```

## HTTPS

Terminate TLS at a reverse proxy in front of the Compose stack. The frontend nginx forwards the
original scheme, so the `Secure` cookie flag is set correctly.

### Caddy (automatic certificates)

```caddyfile
travel.example.com {
    encode gzip
    reverse_proxy 127.0.0.1:8080
}
```

### nginx (certificates from certbot)

```nginx
server {
    listen 443 ssl http2;
    server_name travel.example.com;

    ssl_certificate     /etc/letsencrypt/live/travel.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/travel.example.com/privkey.pem;

    client_max_body_size 512m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300s;
    }
}

server {
    listen 80;
    server_name travel.example.com;
    return 301 https://$host$request_uri;
}
```

Firewall the host so only 80/443 are public. Do not expose PostgreSQL or Redis.

## First-run hardening

1. Create your account immediately.
2. Set `TRAVELTRACE_ALLOW_REGISTRATION=false` in `.env` and restart:
   `docker compose up -d`.
3. Verify login over HTTPS.
4. Do **not** run `demo/seed.py` on a public instance.
5. Add the deployment URL to `TRAVELTRACE_CORS_ORIGINS` only if you call the API cross-origin; the
   bundled nginx setup is same-origin and does not need it.
6. Take a first backup.

There is no password-reset email in v0.1.1. Store the password in a password manager; the owner can
create accounts while registration is open and then close it again.

## Backups and restore

A complete backup needs the database **and** the uploads volume.

```bash
./docker/backup.sh backups
# → backups/traveltrace-db-YYYYMMDD-HHMMSS.dump
# → backups/traveltrace-uploads-YYYYMMDD-HHMMSS.tar
```

Restore into an empty stack:

```bash
docker compose up -d db backend
docker compose exec -T db pg_restore -U traveltrace -d traveltrace --clean --if-exists \
  < backups/traveltrace-db-YYYYMMDD-HHMMSS.dump
docker compose exec -T backend tar -C /data -xf - \
  < backups/traveltrace-uploads-YYYYMMDD-HHMMSS.tar
docker compose up -d
```

Keep backups off the host (object storage, another machine) and test a restore occasionally. The
`redis_data` volume is optional; queued tasks can be lost without affecting imported photos.

## Upgrades

```bash
git pull
docker compose build
docker compose up -d
```

The backend entrypoint applies migrations automatically. For major upgrades:

1. Read `CHANGELOG.md`.
2. Run `./docker/backup.sh`.
3. Rebuild and start.
4. Verify `/api/v1/health` and the dashboard.

Pin image digests or tags if you need reproducible deployments; the Compose file intentionally uses
moving tags for `postgres`, `redis` and `nginx` within their major versions.

## Scaling and operations

- **Photo processing** — increase `--concurrency` in the `worker` command, or run additional workers:
  `docker compose up -d --scale worker=2`. All workers share the uploads volume and the Redis queue.
- **Thread mode** — setting `TRAVELTRACE_TASK_BACKEND=thread` removes the Redis dependency but
  processing then happens inside the API process. Suitable for single-user instances only.
- **Database** — tune PostgreSQL for your disk and memory; for a personal instance the defaults are
  usually enough. Keep the PostGIS extension enabled.
- **Disk** — plan for originals + derivatives. Monitor free space; uploads fail cleanly when the disk
  is full but existing data must be protected.
- **Health** — `GET /api/v1/health` reports API and database status. The Docker health checks use it.
- **Logs** — `docker compose logs -f backend worker`; nginx logs are in the frontend container.

## Migrating from the SQLite development database

There is no automated SQLite → PostgreSQL migration in v0.1.1. The supported path is to deploy
PostgreSQL and re-import photos through the API (metadata is re-extracted from the originals). A
generic importer is on the roadmap. Do not edit the database by hand.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `frontend` restarts / 502 from nginx | Check `docker compose logs backend`; migrations or the database may have failed |
| Backend waits forever on the database | Verify `POSTGRES_PASSWORD` matches the value used when the volume was created |
| Login appears to work but refreshes to the login page | HTTPS misconfiguration causing Secure cookies over HTTP, or a proxy that strips cookies |
| Uploads fail with 413 | Raise `client_max_body_size` in the edge proxy and `TRAVELTRACE_MAX_UPLOAD_MB` |
| Imports stay queued | Check `docker compose logs worker` and Redis health |
| Map is empty | The client cannot reach `VITE_MAP_STYLE_URL`; rebuild with a reachable style |
| Geocoding errors | Enable a provider and check its URL/User-Agent policy |
| Time zone looks wrong | Capture times are wall-clock values by design; check the camera's EXIF offset |
