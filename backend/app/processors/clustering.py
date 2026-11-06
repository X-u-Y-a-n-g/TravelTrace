"""Rule-based photo clustering used to draft a trip timeline.

The v0.1 algorithm deliberately stays explainable: photos are grouped per day and
split when the time gap or distance between consecutive shots is too large, or
when the known place changes. This is the foundation the v0.2 reconstruction
pipeline builds on.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from uuid import UUID

from app.core.geo import haversine_m


@dataclass
class PhotoPoint:
    id: UUID
    taken_at: datetime
    latitude: float | None = None
    longitude: float | None = None
    place_id: UUID | None = None


@dataclass
class PhotoCluster:
    day: date
    photos: list[PhotoPoint] = field(default_factory=list)

    @property
    def start_time(self) -> datetime:
        return min(photo.taken_at for photo in self.photos)

    @property
    def end_time(self) -> datetime:
        return max(photo.taken_at for photo in self.photos)

    @property
    def place_id(self) -> UUID | None:
        counts: dict[UUID, int] = {}
        for photo in self.photos:
            if photo.place_id is not None:
                counts[photo.place_id] = counts.get(photo.place_id, 0) + 1
        if not counts:
            return None
        return max(counts, key=lambda key: counts[key])


def cluster_photos(
    points: list[PhotoPoint],
    *,
    max_gap_minutes: int = 180,
    max_distance_km: float = 3.0,
) -> list[PhotoCluster]:
    if not points:
        return []

    ordered = sorted(points, key=lambda photo: photo.taken_at)
    max_gap_seconds = max_gap_minutes * 60
    max_distance_m = max_distance_km * 1000

    clusters: list[PhotoCluster] = []
    current = PhotoCluster(day=ordered[0].taken_at.date(), photos=[ordered[0]])

    for photo in ordered[1:]:
        previous = current.photos[-1]
        gap = (photo.taken_at - previous.taken_at).total_seconds()

        distance: float | None = None
        if (
            previous.latitude is not None
            and previous.longitude is not None
            and photo.latitude is not None
            and photo.longitude is not None
        ):
            distance = haversine_m(
                previous.latitude, previous.longitude, photo.latitude, photo.longitude
            )

        place_changed = (
            previous.place_id is not None
            and photo.place_id is not None
            and previous.place_id != photo.place_id
        )

        split = (
            photo.taken_at.date() != current.day
            or gap > max_gap_seconds
            or (distance is not None and distance > max_distance_m)
            or (place_changed and gap > 30 * 60)
        )

        if split:
            clusters.append(current)
            current = PhotoCluster(day=photo.taken_at.date(), photos=[photo])
        else:
            current.photos.append(photo)

    clusters.append(current)
    return clusters
