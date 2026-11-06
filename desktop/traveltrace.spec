# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the TravelTrace Windows desktop app."""

from pathlib import Path
import sys

from PyInstaller.utils.hooks import collect_submodules

root = Path(SPECPATH).parent
sys.path.insert(0, str(root / "backend"))
icon = root / "frontend" / "resources" / "icon.ico"
web = root / "frontend" / "dist"

hiddenimports = (
    collect_submodules("app")
    + collect_submodules("uvicorn")
    + [
        "uvicorn.logging",
        "uvicorn.loops.auto",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan.on",
        "sqlalchemy.dialects.sqlite",
        "PIL._tkinter_finder",
        "webview",
        "webview.platforms.edgechromium",
        "webview.platforms.winforms",
    ]
)

a = Analysis(
    [str(root / "desktop" / "main.py")],
    pathex=[str(root), str(root / "backend")],
    binaries=[],
    datas=[(str(web), "webui")],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["pytest", "tests"],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="TravelTrace",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(icon) if icon.exists() else None,
)
