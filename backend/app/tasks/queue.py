"""Pluggable background task execution.

``inline`` runs work during the request (used by tests), ``thread`` uses a small
in-process pool (zero-dependency default) and ``celery`` hands work to a Redis
backed worker for larger deployments.
"""

from __future__ import annotations

import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Protocol
from uuid import UUID

from app.core.config import settings
from app.core.errors import ServiceUnavailableError

logger = logging.getLogger(__name__)


def process_photo_import(task_id: UUID | str) -> None:
    """Entry point shared by every backend (import kept local to avoid cycles)."""
    from app.services.photo_service import process_import_task

    process_import_task(UUID(str(task_id)))


class TaskRunner(Protocol):
    def submit_photo_import(self, task_id: UUID) -> None: ...

    def shutdown(self) -> None: ...


class InlineRunner:
    def submit_photo_import(self, task_id: UUID) -> None:
        try:
            process_photo_import(task_id)
        except Exception:  # pragma: no cover - task state records the failure
            logger.exception("Inline photo import failed for task %s", task_id)

    def shutdown(self) -> None:
        return None


class ThreadRunner:
    def __init__(self) -> None:
        self._executor = ThreadPoolExecutor(
            max_workers=max(settings.task_workers, 1), thread_name_prefix="traveltrace-import"
        )

    def submit_photo_import(self, task_id: UUID) -> None:
        self._executor.submit(process_photo_import, task_id)

    def shutdown(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)


class CeleryRunner:
    def submit_photo_import(self, task_id: UUID) -> None:
        try:
            from app.tasks.celery_app import celery_app
        except ImportError as exc:  # pragma: no cover - optional dependency
            raise ServiceUnavailableError(
                "Celery support is not installed. Install the 'worker' extra.",
                code="worker_unavailable",
            ) from exc
        try:
            celery_app.send_task("app.tasks.photo_tasks.process_photo_import", args=[str(task_id)])
        except Exception as exc:  # pragma: no cover - depends on broker
            logger.exception("Could not enqueue import task %s", task_id)
            raise ServiceUnavailableError(
                "The background worker queue is unavailable", code="worker_unavailable"
            ) from exc

    def shutdown(self) -> None:
        return None


_runner: TaskRunner | None = None
_lock = threading.Lock()


def get_task_runner() -> TaskRunner:
    global _runner
    if _runner is None:
        with _lock:
            if _runner is None:
                if settings.task_backend == "inline":
                    _runner = InlineRunner()
                elif settings.task_backend == "celery":
                    _runner = CeleryRunner()
                else:
                    _runner = ThreadRunner()
    return _runner


def shutdown_task_runner() -> None:
    global _runner
    if _runner is not None:
        _runner.shutdown()
        _runner = None
