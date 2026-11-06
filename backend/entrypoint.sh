#!/bin/sh
set -eu

echo "TravelTrace: waiting for the database…"
python - <<'PY'
import sys
import time

from sqlalchemy import create_engine, text

from app.core.config import settings

for attempt in range(1, 61):
    try:
        engine = create_engine(settings.database_url, pool_pre_ping=True)
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        print("Database is ready.")
        break
    except Exception as exc:  # noqa: BLE001 - retry until the database accepts us
        print(f"  attempt {attempt}/60: {exc}", flush=True)
        time.sleep(2)
else:
    sys.exit("Database did not become available in time.")
PY

if [ "${TRAVELTRACE_SKIP_MIGRATIONS:-false}" != "true" ]; then
    echo "TravelTrace: applying migrations…"
    alembic upgrade head
fi

if [ "$#" -gt 0 ]; then
    exec "$@"
fi

echo "TravelTrace: starting API…"
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --proxy-headers \
    --forwarded-allow-ips='*'
