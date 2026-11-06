"""FastAPI dependencies: sessions, authentication and pagination."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import UnauthorizedError
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import Trip, User
from app.services import trip_service

AUTH_COOKIE = "traveltrace_token"
bearer_scheme = HTTPBearer(auto_error=False, description="JWT access token")


def _authenticate(db: Session, token: str | None) -> User:
    if not token:
        raise UnauthorizedError("Authentication required", code="not_authenticated")
    user_id: UUID = decode_access_token(token)
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("Authentication required", code="not_authenticated")
    return user


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials if credentials else request.cookies.get(AUTH_COOKIE)
    return _authenticate(db, token)


def get_media_user(
    request: Request,
    access_token: str | None = Query(
        default=None,
        include_in_schema=False,
        description="Media token for native clients that cannot set headers on <img> URLs",
    ),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Authenticate media requests from headers, cookies or a query token.

    Native WebViews cannot attach an Authorization header to ``<img>`` or download
    URLs, so the mobile app appends the JWT as ``access_token``. Bearer and cookie
    auth keep precedence for browser clients.
    """

    token = (
        credentials.credentials if credentials else access_token or request.cookies.get(AUTH_COOKIE)
    )
    return _authenticate(db, token)


@dataclass(slots=True)
class Pagination:
    page: int
    size: int


def pagination(
    page: int = Query(default=1, ge=1, description="1-based page number"),
    size: int = Query(default=24, ge=1, le=100, description="Items per page"),
) -> Pagination:
    return Pagination(page=page, size=size)


def owned_trip(
    trip_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Trip:
    return trip_service.get_trip(db, trip_id, user.id)
