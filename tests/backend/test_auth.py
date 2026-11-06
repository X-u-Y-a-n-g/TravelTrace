"""Authentication and account tests."""

from __future__ import annotations

from uuid import uuid4

from conftest import DEFAULT_PASSWORD, register_user

from app.core.config import settings
from app.core.security import create_access_token


def test_bootstrap_first_run(client):
    response = client.get("/api/v1/auth/bootstrap")
    assert response.status_code == 200
    body = response.json()
    assert body["has_users"] is False
    assert body["registration_enabled"] is True
    assert body["app_version"] == "0.2.0"


def test_register_sets_cookie_and_returns_user(client):
    data = register_user(client, username="explorer", display_name="Explorer")
    assert data["token_type"] == "bearer"
    assert data["expires_in"] > 0
    assert data["user"]["username"] == "explorer"
    assert data["user"]["display_name"] == "Explorer"
    assert "traveltrace_token" in client.cookies

    # Cookie-only auth (this is how <img> requests authenticate).
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 200
    assert response.json()["username"] == "explorer"

    bootstrap = client.get("/api/v1/auth/bootstrap").json()
    assert bootstrap["has_users"] is True


def test_duplicate_username_and_email(client):
    register_user(client, username="taken", email="taken@example.com")
    duplicate_username = client.post(
        "/api/v1/auth/register",
        json={
            "username": "TAKEN",
            "email": "other@example.com",
            "password": DEFAULT_PASSWORD,
        },
    )
    assert duplicate_username.status_code == 409
    assert duplicate_username.json()["error"]["code"] == "username_taken"

    duplicate_email = client.post(
        "/api/v1/auth/register",
        json={
            "username": "another",
            "email": "Taken@Example.com",
            "password": DEFAULT_PASSWORD,
        },
    )
    assert duplicate_email.status_code == 409
    assert duplicate_email.json()["error"]["code"] == "email_taken"


def test_registration_validation(client):
    response = client.post(
        "/api/v1/auth/register",
        json={"username": "ab", "email": "not-an-email", "password": "short"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    fields = {item["field"] for item in response.json()["error"]["details"]}
    assert {"username", "email", "password"} <= fields


def test_login_and_logout(client):
    register_user(client, username="loginuser", email="login@example.com")
    client.cookies.clear()

    wrong = client.post(
        "/api/v1/auth/login",
        json={"identifier": "loginuser", "password": "wrong-password"},
    )
    assert wrong.status_code == 401
    assert wrong.json()["error"]["code"] == "invalid_credentials"

    by_email = client.post(
        "/api/v1/auth/login",
        json={"identifier": "login@example.com", "password": DEFAULT_PASSWORD},
    )
    assert by_email.status_code == 200
    token = by_email.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200

    logout = client.post("/api/v1/auth/logout")
    assert logout.status_code == 204
    client.cookies.clear()
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 401


def test_invalid_and_expired_tokens(client):
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-token"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_token"

    token, _ = create_access_token(uuid4(), expires_minutes=-5)
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "token_expired"


def test_registration_can_be_disabled(client, monkeypatch):
    register_user(client)
    monkeypatch.setattr(settings, "allow_registration", False)
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": "newcomer",
            "email": "newcomer@example.com",
            "password": DEFAULT_PASSWORD,
        },
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "registration_closed"


def test_update_profile_and_password(client, auth):
    response = client.patch(
        "/api/v1/auth/me", json={"display_name": "Renamed"}, headers=auth.headers
    )
    assert response.status_code == 200
    assert response.json()["display_name"] == "Renamed"

    wrong = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "nope", "new_password": "another-secret-123"},
        headers=auth.headers,
    )
    assert wrong.status_code == 401

    changed = client.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": DEFAULT_PASSWORD,
            "new_password": "another-secret-123",
        },
        headers=auth.headers,
    )
    assert changed.status_code == 200

    login = client.post(
        "/api/v1/auth/login",
        json={"identifier": auth.user["username"], "password": "another-secret-123"},
    )
    assert login.status_code == 200
