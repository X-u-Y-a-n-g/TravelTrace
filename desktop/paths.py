"""Desktop paths and data-directory helpers for TravelTrace."""

from __future__ import annotations

import os
import sys
from pathlib import Path


def bundle_dir() -> Path:
    """Directory containing bundled resources (PyInstaller) or the repository root."""
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS"))
    return Path(__file__).resolve().parents[1]


def executable_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[1]


def web_dir() -> Path:
    bundled = bundle_dir() / "webui"
    if bundled.is_dir():
        return bundled
    return bundle_dir() / "frontend" / "dist"


def default_data_dir() -> Path:
    override = os.environ.get("TRAVELTRACE_DATA_DIR")
    if override:
        return Path(override).expanduser().resolve()
    if sys.platform == "win32":
        base = os.environ.get("APPDATA")
        if base:
            return Path(base) / "TravelTrace"
    return Path.home() / ".traveltrace"


def ensure_data_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    (path / "uploads").mkdir(parents=True, exist_ok=True)
    return path


def ensure_secret(path: Path) -> str:
    secret_file = path / ".secret_key"
    if secret_file.exists():
        value = secret_file.read_text(encoding="utf-8").strip()
        if len(value) >= 32:
            return value
    import secrets

    value = secrets.token_urlsafe(48)
    secret_file.write_text(value, encoding="utf-8")
    try:
        secret_file.chmod(0o600)
    except OSError:
        pass
    return value
