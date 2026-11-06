"""TravelTrace FastAPI application."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

import app.models  # noqa: F401 - register ORM models before create_all
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import AppError
from app.db.base import Base
from app.db.session import engine
from app.tasks.queue import shutdown_task_runner

logger = logging.getLogger("traveltrace")

TAGS_METADATA = [
    {"name": "auth", "description": "Registration, sign-in and profile"},
    {"name": "trips", "description": "Create and manage trips, export data"},
    {"name": "timeline", "description": "Timeline events and auto-generated drafts"},
    {"name": "places", "description": "Reusable places and trip visits"},
    {"name": "photos", "description": "Upload, EXIF extraction and photo library"},
    {"name": "imports", "description": "Asynchronous photo import tasks"},
    {"name": "map", "description": "Map markers and route geometries"},
    {"name": "dashboard", "description": "Travel statistics and instance settings"},
    {"name": "health", "description": "Liveness and readiness"},
]


def _error_response(
    status_code: int, code: str, message: str, details: object = None
) -> JSONResponse:
    payload: dict = {"error": {"code": code, "message": message}}
    if details is not None:
        payload["error"]["details"] = details
    return JSONResponse(status_code=status_code, content=payload)


@asynccontextmanager
async def lifespan(_app: FastAPI):  # noqa: ANN202
    logging.basicConfig(
        level=getattr(logging, settings.environment == "development" and "INFO" or "INFO")
    )
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.storage_dir.mkdir(parents=True, exist_ok=True)

    if settings.auto_create_tables:
        Base.metadata.create_all(bind=engine)

    logger.info(
        "TravelTrace %s starting (env=%s, db=%s, tasks=%s)",
        settings.app_version,
        settings.environment,
        engine.dialect.name,
        settings.task_backend,
    )
    yield
    shutdown_task_runner()
    logger.info("TravelTrace stopped")


def create_app() -> FastAPI:
    application = FastAPI(
        title="TravelTrace API",
        version=settings.app_version,
        description=(
            "Your journey, reconstructed. TravelTrace turns photos into a map-first "
            "travel memory: upload photos, extract GPS and time, and build a timeline."
        ),
        openapi_url="/api/openapi.json",
        docs_url="/api/docs",
        redoc_url=None,
        openapi_tags=TAGS_METADATA,
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )
    application.add_middleware(GZipMiddleware, minimum_size=1200)

    @application.middleware("http")
    async def security_headers(request: Request, call_next):  # noqa: ANN001, ANN202
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Permissions-Policy", "geolocation=(), camera=()")
        return response

    @application.exception_handler(AppError)
    async def handle_app_error(_request: Request, exc: AppError) -> JSONResponse:  # noqa: ANN202
        return _error_response(exc.status_code, exc.code, exc.message, exc.details)

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = [
            {
                "field": ".".join(str(part) for part in error["loc"] if part != "body"),
                "message": error["msg"],
                "type": error["type"],
            }
            for error in exc.errors()
        ]
        return _error_response(422, "validation_error", "Request validation failed", details)

    @application.exception_handler(StarletteHTTPException)
    async def handle_http_error(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {401: "unauthorized", 403: "forbidden", 404: "not_found"}.get(
            exc.status_code, "http_error"
        )
        return _error_response(exc.status_code, code, str(exc.detail))

    @application.exception_handler(Exception)
    async def handle_unexpected(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error: %s", exc)
        return _error_response(500, "internal_error", "An unexpected error occurred")

    @application.get("/", include_in_schema=False)
    def root() -> dict:
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "tagline": "Your journey, reconstructed.",
            "docs": "/api/docs",
            "health": "/api/v1/health",
        }

    application.include_router(api_router, prefix=settings.api_v1_prefix)
    return application


app = create_app()
