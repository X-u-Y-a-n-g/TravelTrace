"""Celery application factory (optional ``worker`` extra)."""

from __future__ import annotations

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "traveltrace",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    broker_connection_retry_on_startup=True,
    worker_max_tasks_per_child=200,
)
# The actual tasks live in app.tasks.photo_tasks; importing it registers them.
celery_app.autodiscover_tasks(["app.tasks"], related_name="photo_tasks")
