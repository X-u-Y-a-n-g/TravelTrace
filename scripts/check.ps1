# Run every check locally (Windows PowerShell).
# Usage: ./scripts/check.ps1 [-SkipBuild]
param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Python = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    throw "Virtual environment not found at .venv. See docs/development.md."
}

Write-Host "`n==> Ruff" -ForegroundColor Cyan
& $Python -m ruff check backend tests
& $Python -m ruff format --check backend tests

Write-Host "`n==> Pytest" -ForegroundColor Cyan
& $Python -m pytest

Write-Host "`n==> Frontend" -ForegroundColor Cyan
Push-Location (Join-Path $Root "frontend")
try {
    npm run lint
    npm run typecheck
    npm run test
    if (-not $SkipBuild) {
        npm run build
    }
}
finally {
    Pop-Location
}

Write-Host "`nAll checks passed." -ForegroundColor Green
