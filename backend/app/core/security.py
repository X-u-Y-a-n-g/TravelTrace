"""Password hashing and JWT helpers."""

from __future__ import annotations

import contextlib
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

import bcrypt
import jwt

from app.core.config import settings
from app.core.errors import UnauthorizedError

_PASSWORD_MIN = 8
_PASSWORD_MAX_BYTES = 72  # bcrypt truncates beyond 72 bytes


def validate_password(password: str) -> str:
    if len(password) < _PASSWORD_MIN:
        raise ValueError(f"Password must be at least {_PASSWORD_MIN} characters long")
    if len(password.encode("utf-8")) > _PASSWORD_MAX_BYTES:
        raise ValueError("Password must be at most 72 bytes long")
    return password


def hash_password(password: str) -> str:
    validate_password(password)
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _load_or_create_secret_key() -> str:
    """Use the configured key, or create a persistent one inside the data dir.

    Persisting the key keeps sessions valid across restarts while still allowing
    a zero-configuration ``docker compose up``.
    """
    if settings.secret_key:
        return settings.secret_key

    key_file: Path = settings.secret_key_file
    try:
        if key_file.exists():
            value = key_file.read_text(encoding="utf-8").strip()
            if value:
                return value
        key_file.parent.mkdir(parents=True, exist_ok=True)
        value = secrets.token_urlsafe(64)
        key_file.write_text(value, encoding="utf-8")
        with contextlib.suppress(OSError):  # pragma: no cover - Windows may not support chmod
            key_file.chmod(0o600)
        return value
    except OSError:
        # Read-only filesystem: fall back to an ephemeral key.
        return secrets.token_urlsafe(64)


_SECRET_CACHE: str | None = None


def get_secret_key() -> str:
    global _SECRET_CACHE
    if _SECRET_CACHE is None:
        _SECRET_CACHE = _load_or_create_secret_key()
    return _SECRET_CACHE


def create_access_token(subject: UUID | str, expires_minutes: int | None = None) -> tuple[str, int]:
    expires_in = (expires_minutes or settings.access_token_expire_minutes) * 60
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(subject),
        "iss": settings.jwt_issuer,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in)).timestamp()),
    }
    token = jwt.encode(payload, get_secret_key(), algorithm=settings.jwt_algorithm)
    return token, expires_in


def decode_access_token(token: str) -> UUID:
    try:
        payload = jwt.decode(
            token,
            get_secret_key(),
            algorithms=[settings.jwt_algorithm],
            issuer=settings.jwt_issuer,
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedError(
            "Session expired, please sign in again", code="token_expired"
        ) from exc
    except jwt.PyJWTError as exc:
        raise UnauthorizedError("Invalid authentication token", code="invalid_token") from exc

    try:
        return UUID(str(payload["sub"]))
    except (KeyError, ValueError, TypeError) as exc:
        raise UnauthorizedError("Invalid authentication token", code="invalid_token") from exc
