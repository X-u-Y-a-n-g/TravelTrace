# syntax=docker/dockerfile:1
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# exiftool is optional (Pillow is the baseline), but it improves metadata
# coverage for exotic cameras; curl is useful for troubleshooting.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libimage-exiftool-perl curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml README.md alembic.ini entrypoint.sh ./
COPY app ./app
COPY migrations ./migrations

RUN pip install --upgrade pip \
    && pip install ".[worker]"

RUN useradd --create-home --uid 10001 traveltrace \
    && mkdir -p /data/uploads \
    && chown -R traveltrace:traveltrace /app /data

ENV TRAVELTRACE_STORAGE_DIR=/data/uploads \
    TRAVELTRACE_ENVIRONMENT=production \
    TRAVELTRACE_AUTO_CREATE_TABLES=false

USER traveltrace
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=3)"

ENTRYPOINT ["sh", "/app/entrypoint.sh"]
