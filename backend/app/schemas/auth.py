"""Authentication and account schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import ORMModel

USERNAME_PATTERN = r"^[a-zA-Z0-9](?:[a-zA-Z0-9_.-]{1,48}[a-zA-Z0-9])?$"

Username = Annotated[str, Field(min_length=3, max_length=50, pattern=USERNAME_PATTERN)]
Password = Annotated[str, Field(min_length=8, max_length=72)]


class UserCreate(BaseModel):
    username: Username
    email: EmailStr
    password: Password
    display_name: Annotated[str | None, Field(max_length=100)] = None

    @field_validator("username", "display_name")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value


class UserLogin(BaseModel):
    identifier: Annotated[str, Field(min_length=3, max_length=255)]
    password: Annotated[str, Field(min_length=1, max_length=200)]


class UserUpdate(BaseModel):
    display_name: Annotated[str | None, Field(max_length=100)] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: Password


class UserOut(ORMModel):
    id: uuid.UUID
    username: str
    email: str
    display_name: str | None
    created_at: datetime
    last_login_at: datetime | None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class BootstrapOut(BaseModel):
    has_users: bool
    registration_enabled: bool
    app_version: str
    app_name: str
