# Build the TravelTrace Windows desktop EXE.
#
# Requirements:
#   .\.venv\Scripts\python.exe -m pip install pywebview pyinstaller
#
# Run from the repository root:
#   .\desktop\build.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path "$root\frontend\dist\index.html")) {
    Set-Location "$root\frontend"
    npm run build
    Set-Location $root
}

& "$root\.venv\Scripts\pyinstaller.exe" "$root\desktop\traveltrace.spec" --noconfirm --clean
if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller failed with exit code $LASTEXITCODE"
}

$exe = Join-Path $root "dist\TravelTrace.exe"
if (-not (Test-Path $exe)) {
    throw "Expected EXE not found: $exe"
}
Write-Host "Built $exe"
