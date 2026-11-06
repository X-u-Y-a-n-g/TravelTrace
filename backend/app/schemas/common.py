"""Shared schema helpers."""

from __future__ import annotations

from math import ceil
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(cls, items: list[T], total: int, page: int, size: int) -> Page[T]:
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=max(ceil(total / size), 1) if total else 0,
        )


class Message(BaseModel):
    message: str
