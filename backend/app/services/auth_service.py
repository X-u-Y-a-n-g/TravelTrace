"""Account registration and authentication."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, UnauthorizedError
from app.core.security import hash_password, verify_password
from app.models import User


def _normalise_email(email: str) -> str:
    return email.strip().lower()


def _find_by_username(db: Session, username: str) -> User | None:
    return db.scalar(select(User).where(func.lower(User.username) == username.lower()))


def _find_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(func.lower(User.email) == _normalise_email(email)))


def has_users(db: Session) -> bool:
    return db.scalar(select(func.count(User.id))) > 0


def register(
    db: Session,
    *,
    username: str,
    email: str,
    password: str,
    display_name: str | None = None,
) -> User:
    username = username.strip()
    if _find_by_username(db, username) is not None:
        raise ConflictError("That username is already taken", code="username_taken")
    if _find_by_email(db, email) is not None:
        raise ConflictError("That email is already registered", code="email_taken")

    user = User(
        username=username,
        email=_normalise_email(email),
        password_hash=hash_password(password),
        display_name=(display_name or username).strip() or username,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate(db: Session, *, identifier: str, password: str) -> User:
    identifier = identifier.strip()
    user = db.scalar(
        select(User).where(
            or_(
                func.lower(User.username) == identifier.lower(),
                func.lower(User.email) == identifier.lower(),
            )
        )
    )
    if user is None or not verify_password(password, user.password_hash):
        raise UnauthorizedError("Incorrect username or password", code="invalid_credentials")
    if not user.is_active:
        raise UnauthorizedError("This account has been disabled", code="account_disabled")

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user


def update_profile(db: Session, user: User, *, display_name: str | None) -> User:
    if display_name is not None:
        cleaned = display_name.strip()
        if not cleaned:
            raise ConflictError("Display name cannot be empty", code="invalid_display_name")
        user.display_name = cleaned[:100]
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, *, current_password: str, new_password: str) -> None:
    if not verify_password(current_password, user.password_hash):
        raise UnauthorizedError("Current password is incorrect", code="invalid_credentials")
    user.password_hash = hash_password(new_password)
    db.commit()
