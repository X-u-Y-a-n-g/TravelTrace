"""Authentication cookie helpers.

The JWT is returned in the response body and also stored in an HttpOnly cookie so
that ``<img>`` tags can load protected photos without a custom fetch layer. The
``Secure`` flag follows the request scheme, so plain-HTTP self-hosting and HTTPS
deployments both work.
"""

from __future__ import annotations

from fastapi import Response

AUTH_COOKIE = "traveltrace_token"


def set_auth_cookie(response: Response, token: str, expires_in: int, *, secure: bool) -> None:
    response.set_cookie(
        key=AUTH_COOKIE,
        value=token,
        max_age=expires_in,
        httponly=True,
        samesite="lax",
        secure=secure,
        path="/",
    )


def clear_auth_cookie(response: Response, *, secure: bool) -> None:
    response.delete_cookie(
        key=AUTH_COOKIE,
        path="/",
        httponly=True,
        samesite="lax",
        secure=secure,
    )
