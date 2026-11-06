"""Celery tasks."""

from __future__ import annotations

from app.tasks.celery_app import celery_app
from app.tasks.queue import process_photo_import


@celery_app.task(name="app.tasks.photo_tasks.process_photo_import", max_retries=1)
def process_photo_import_task(task_id: str) -> None:
    process_photo_import(task_id)
