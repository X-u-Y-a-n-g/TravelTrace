"""Import task queries and cancellation."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError
from app.models import ImportTask
from app.models.enums import ImportStatus
from app.schemas.common import Page
from app.schemas.import_task import ImportTaskOut

TERMINAL_STATUSES = {
    ImportStatus.succeeded,
    ImportStatus.partial,
    ImportStatus.failed,
    ImportStatus.cancelled,
}


def list_tasks(
    db: Session,
    user_id: UUID,
    *,
    page: int,
    size: int,
    status: str | None = None,
    trip_id: UUID | None = None,
) -> Page:  # noqa: ANN201
    stmt = select(ImportTask).where(ImportTask.user_id == user_id)
    if status:
        stmt = stmt.where(ImportTask.status == status)
    if trip_id is not None:
        stmt = stmt.where(ImportTask.trip_id == trip_id)
    total = int(db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
    tasks = db.scalars(
        stmt.order_by(ImportTask.created_at.desc()).offset((page - 1) * size).limit(size)
    ).all()
    return Page.build([ImportTaskOut.model_validate(task) for task in tasks], total, page, size)


def get_task(db: Session, task_id: UUID, user_id: UUID) -> ImportTask:
    task = db.scalar(
        select(ImportTask).where(ImportTask.id == task_id, ImportTask.user_id == user_id)
    )
    if task is None:
        raise NotFoundError("Import task not found")
    return task


def cancel_task(db: Session, task: ImportTask) -> ImportTask:
    if task.status in TERMINAL_STATUSES:
        raise ConflictError("This import has already finished", code="task_finished")
    task.status = ImportStatus.cancelled
    task.message = "Import cancelled"
    db.commit()
    db.refresh(task)
    return task
