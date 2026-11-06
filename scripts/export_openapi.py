#!/usr/bin/env python
"""Write the OpenAPI contract to shared/openapi.json.

Run from the repository root with the backend environment active:

    python scripts/export_openapi.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.main import app  # noqa: E402


def main() -> int:
    specification = app.openapi()
    destination = ROOT / "shared" / "openapi.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(specification, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    paths = specification.get("paths", {})
    operations = sum(
        1
        for path in paths.values()
        for method in path
        if method in {"get", "post", "patch", "put", "delete"}
    )
    print(f"Wrote {destination} — {len(paths)} paths, {operations} operations")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
