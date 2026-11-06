"""Application configuration loaded from environment variables.

All settings use the ``TRAVELTRACE_`` prefix, e.g. ``TRAVELTRACE_DATABASE_URL``.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="TRAVELTRACE_",
        env_file=(str(BACKEND_DIR / ".env"), str(REPO_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Identity ---------------------------------------------------------
    app_name: str = "TravelTrace"
    app_version: str = "0.3.0"
    environment: Literal["development", "test", "production"] = "development"
    api_v1_prefix: str = "/api/v1"

    # --- Security ---------------------------------------------------------
    secret_key: str = ""
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = "traveltrace"
    access_token_expire_minutes: int = 60 * 24 * 7
    allow_registration: bool = True
    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:4173,http://127.0.0.1:4173,http://localhost:8080,"
        "http://localhost,https://localhost,capacitor://localhost"
    )

    # --- Database ---------------------------------------------------------
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'data' / 'traveltrace.db').as_posix()}"
    sql_echo: bool = False
    auto_create_tables: bool = True

    # --- Storage ----------------------------------------------------------
    storage_dir: Path = BACKEND_DIR / "data" / "uploads"
    max_upload_mb: int = 25
    max_upload_files: int = 60
    thumbnail_px: int = 640
    preview_px: int = 1600
    thumbnail_quality: int = 78
    preview_quality: int = 84
    exiftool_enabled: bool = True

    # --- Background tasks -------------------------------------------------
    task_backend: Literal["inline", "thread", "celery"] = "thread"
    task_workers: int = 2
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    # --- Geocoding (optional, privacy-friendly: disabled by default) ------
    geocoding_provider: Literal["none", "nominatim"] = "none"
    geocoding_url: str = "https://nominatim.openstreetmap.org"
    geocoding_user_agent: str = "TravelTrace/0.1 (self-hosted)"
    geocoding_timeout_seconds: float = 8.0
    geocoding_min_interval_seconds: float = 1.0

    # --- Limits -----------------------------------------------------------
    max_photos_per_map_request: int = 2000
    export_include_originals: bool = True

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def data_dir(self) -> Path:
        if self.is_sqlite:
            prefix = "sqlite:///"
            raw = self.database_url[len(prefix) :]
            # Strip SQLite query parameters such as ?check_same_thread=false
            raw = raw.split("?", 1)[0]
            if raw and raw != ":memory:":
                return Path(raw).expanduser().resolve().parent
        return BACKEND_DIR / "data"

    @property
    def secret_key_file(self) -> Path:
        return self.data_dir / ".secret_key"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
