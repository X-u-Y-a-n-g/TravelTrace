"""TravelTrace desktop launcher.

Runs the existing FastAPI backend in-process with SQLite and the local photo
store, serves the built React UI, and opens a native desktop window. The same
entry point builds into a one-file Windows EXE with PyInstaller.
"""

from __future__ import annotations

import argparse
import os
import socket
import sys
import tempfile
import threading
import time
import traceback
import urllib.request
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from desktop.import_data import candidate_sources, import_existing_data
from desktop.paths import (
    default_data_dir,
    ensure_data_dir,
    ensure_secret,
    web_dir,
)


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _wait_for_server(url: str, timeout: float = 25.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return True
        except Exception:
            time.sleep(0.2)
    return False


def _prompt_import(data_dir: Path) -> None:
    if (data_dir / "traveltrace.db").exists():
        return
    candidates = candidate_sources()
    if not candidates:
        return
    try:
        import tkinter as tk
        from tkinter import messagebox

        root = tk.Tk()
        root.withdraw()
        source = candidates[0]
        answer = messagebox.askyesno(
            "TravelTrace",
            f"发现已有 TravelTrace 数据：\n{source}\n\n是否导入到本地单机版？\n"
            f"数据目录：{data_dir}",
        )
        if answer:
            summary = import_existing_data(source, data_dir)
            messagebox.showinfo(
                "TravelTrace",
                f"导入完成：{summary.trips} 次旅行，{summary.photos} 张照片。",
            )
        root.destroy()
    except Exception as exc:
        # Tk may be unavailable in a headless build; never block startup.
        print(f"Import prompt unavailable: {exc}", file=sys.stderr)


def _import_from_arg(source: Path, data_dir: Path) -> None:
    summary = import_existing_data(source, data_dir)
    print(
        f"Imported {summary.trips} trips / {summary.photos} photos into {data_dir}"
    )
    if summary.backup:
        print(f"Previous database backed up to {summary.backup}")


def _build_app(web: Path):
    from fastapi import FastAPI
    from fastapi.responses import FileResponse
    from fastapi.staticfiles import StaticFiles
    from starlette.exceptions import HTTPException

    from app.main import app

    # The web deployment exposes a JSON landing page at "/". The desktop shell
    # serves the SPA there instead; API routes remain untouched.
    app.router.routes = [
        route for route in app.router.routes if getattr(route, "path", None) != "/"
    ]

    assets = web / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets)), name="desktop-assets")

    @app.get("/", include_in_schema=False)
    def serve_index() -> FileResponse:
        return FileResponse(web / "index.html", headers={"Cache-Control": "no-cache"})

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str) -> FileResponse:  # noqa: ANN001
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        candidate = (web / full_path).resolve()
        if web == candidate or web in candidate.parents:
            if candidate.is_file():
                return FileResponse(candidate)
        index = web / "index.html"
        if not index.is_file():
            raise HTTPException(
                status_code=500,
                detail="Frontend build missing. Run `npm run build` in frontend/ first.",
            )
        return FileResponse(index, headers={"Cache-Control": "no-cache"})

    return app


def _start_server(app: FastAPI, port: int):
    import uvicorn

    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=port,
        log_level="warning",
        access_log=False,
    )
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, name="traveltrace-api", daemon=True)
    thread.start()
    return server


def _install_frozen_log() -> Path | None:
    if not getattr(sys, "frozen", False):
        return None
    log_path = Path(tempfile.gettempdir()) / "TravelTrace-desktop.log"
    try:
        stream = open(log_path, "a", encoding="utf-8", buffering=1)
        sys.stdout = stream
        sys.stderr = stream
        print(f"\n--- TravelTrace desktop {time.strftime('%Y-%m-%d %H:%M:%S')} ---")
        return log_path
    except OSError:
        return None


def main(argv: list[str] | None = None) -> int:
    log_path = _install_frozen_log()
    if log_path:
        print(f"Data will be stored under the TravelTrace app data directory.")
    parser = argparse.ArgumentParser(description="TravelTrace desktop")
    parser.add_argument("--data-dir", type=Path, help="Override the local data directory")
    parser.add_argument("--import-data", type=Path, help="Import an existing data directory")
    parser.add_argument("--headless", action="store_true", help="Run the API without a window")
    parser.add_argument("--check", action="store_true", help="Start, verify and exit")
    parser.add_argument("--port", type=int, help="Fixed local port (default: random)")
    parser.add_argument("--no-import-prompt", action="store_true")
    args = parser.parse_args(argv)

    data_dir = ensure_data_dir((args.data_dir or default_data_dir()).expanduser().resolve())
    if args.import_data:
        _import_from_arg(args.import_data, data_dir)
    elif not args.headless and not args.check and not args.no_import_prompt:
        _prompt_import(data_dir)

    backend_dir = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[1])) / "backend"
    if not backend_dir.is_dir():
        backend_dir = Path(__file__).resolve().parents[1] / "backend"
    sys.path.insert(0, str(backend_dir))

    os.environ.setdefault("TRAVELTRACE_ENVIRONMENT", "production")
    os.environ.setdefault(
        "TRAVELTRACE_DATABASE_URL", f"sqlite:///{(data_dir / 'traveltrace.db').as_posix()}"
    )
    os.environ.setdefault("TRAVELTRACE_STORAGE_DIR", str(data_dir / "uploads"))
    os.environ.setdefault("TRAVELTRACE_SECRET_KEY", ensure_secret(data_dir))
    os.environ.setdefault("TRAVELTRACE_TASK_BACKEND", "thread")
    os.environ.setdefault("TRAVELTRACE_AUTO_CREATE_TABLES", "true")
    os.environ.setdefault("TRAVELTRACE_ALLOW_REGISTRATION", "true")
    os.environ.setdefault("TRAVELTRACE_CORS_ORIGINS", "http://127.0.0.1,http://localhost")

    web = web_dir()
    app = _build_app(web)
    port = args.port or _find_free_port()
    server = _start_server(app, port)
    url = f"http://127.0.0.1:{port}/"

    if not _wait_for_server(url + "api/v1/health"):
        print("TravelTrace server did not start", file=sys.stderr)
        server.should_exit = True
        return 1

    print(f"TravelTrace desktop data: {data_dir}")
    print(f"TravelTrace desktop URL: {url}")

    if args.check:
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                html = response.read(50_000).decode("utf-8", "replace")
            if 'id="root"' not in html:
                print("Frontend index.html was not served correctly", file=sys.stderr)
                print(html[:500], file=sys.stderr)
                server.should_exit = True
                return 1
            print("Desktop check OK")
            return 0
        finally:
            server.should_exit = True

    if args.headless:
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass
        finally:
            server.should_exit = True
        return 0

    try:
        import webview

        webview.create_window(
            "TravelTrace",
            url,
            width=1280,
            height=860,
            min_size=(980, 680),
            background_color="#f7f2e8",
        )
        webview.start()
    except Exception as exc:
        print(f"Native window unavailable ({exc}); opening the browser.", file=sys.stderr)
        import webbrowser

        webbrowser.open(url)
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass
    finally:
        server.should_exit = True
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except BaseException:
        traceback.print_exc()
        raise
