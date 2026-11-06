"""Authentication endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.api.cookies import clear_auth_cookie, set_auth_cookie
from app.api.deps import get_current_user
from app.core.config import settings
from app.core.errors import ForbiddenError
from app.core.security import create_access_token
from app.db.session import get_db
from app.models import User
from app.schemas.auth import (
    BootstrapOut,
    PasswordChange,
    TokenOut,
    UserCreate,
    UserLogin,
    UserOut,
    UserUpdate,
)
from app.schemas.common import Message
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_response(request: Request, response: Response, user: User) -> TokenOut:
    token, expires_in = create_access_token(user.id)
    set_auth_cookie(response, token, expires_in, secure=request.url.scheme == "https")
    return TokenOut(
        access_token=token,
        expires_in=expires_in,
        user=UserOut.model_validate(user),
    )


@router.get("/bootstrap", response_model=BootstrapOut, summary="First-run state")
def bootstrap(db: Session = Depends(get_db)) -> BootstrapOut:
    return BootstrapOut(
        has_users=auth_service.has_users(db),
        registration_enabled=settings.allow_registration,
        app_version=settings.app_version,
        app_name=settings.app_name,
    )


@router.post(
    "/register",
    response_model=TokenOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create an account",
)
def register(
    payload: UserCreate,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenOut:
    if not settings.allow_registration and auth_service.has_users(db):
        raise ForbiddenError(
            "Registration is disabled on this instance", code="registration_closed"
        )
    user = auth_service.register(
        db,
        username=payload.username,
        email=payload.email,
        password=payload.password,
        display_name=payload.display_name,
    )
    return _token_response(request, response, user)


@router.post("/login", response_model=TokenOut, summary="Sign in")
def login(
    payload: UserLogin,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenOut:
    user = auth_service.authenticate(db, identifier=payload.identifier, password=payload.password)
    return _token_response(request, response, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Sign out")
def logout(request: Request, response: Response) -> Response:
    clear_auth_cookie(response, secure=request.url.scheme == "https")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserOut, summary="Current profile")
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("/me", response_model=UserOut, summary="Update profile")
def update_me(
    payload: UserUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    return auth_service.update_profile(db, user, display_name=payload.display_name)


@router.post("/change-password", response_model=Message, summary="Change password")
def change_password(
    payload: PasswordChange,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Message:
    auth_service.change_password(
        db,
        user,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    return Message(message="Password updated")
