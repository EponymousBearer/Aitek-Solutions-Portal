#!/usr/bin/env pwsh
# Hot-reload local dev stack. Build the dev images once; after that, edits to
# apps/web or apps/api reflect live (next dev HMR / nest --watch) with no rebuild.
#
# Usage:
#   .\scripts\dev-watch.ps1            # build dev images (first run) + start
#   .\scripts\dev-watch.ps1 -SkipBuild # just (re)start, no image build
#   .\scripts\dev-watch.ps1 -Reseed    # force re-run seed (idempotent)

param(
    [switch]$SkipBuild,
    [switch]$Reseed,
    [string]$AdminEmail = "info@aitek-solutions.com"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$ComposeFlags = @("-f", "docker-compose.yml", "-f", "docker-compose.dev.yml")

if (-not $SkipBuild) {
    Write-Host "Building dev images (hot-reload)..." -ForegroundColor Cyan
    docker compose @ComposeFlags build api web
    if ($LASTEXITCODE -ne 0) { throw "Build failed" }
}

Write-Host "Starting postgres..." -ForegroundColor Cyan
docker compose @ComposeFlags up -d postgres
if ($LASTEXITCODE -ne 0) { throw "postgres failed to start" }

# Wait for postgres to be healthy
Write-Host "Waiting for postgres healthcheck..." -ForegroundColor Cyan
for ($i = 0; $i -lt 30; $i++) {
    $status = docker inspect --format '{{.State.Health.Status}}' portal-aitek-solutions-postgres-1 2>$null
    if ($status -eq "healthy") { break }
    Start-Sleep -Seconds 2
}

Write-Host "Running prisma migrate deploy..." -ForegroundColor Cyan
docker compose @ComposeFlags --profile migrate run --rm migrate
if ($LASTEXITCODE -ne 0) { throw "Migrate failed" }

# Seed if the users table is empty OR -Reseed was passed. Unlike the production
# runner image, the dev image carries the full monorepo + tsconfig, so the plain
# `npm run seed` script works as-is.
$userCount = (docker exec portal-aitek-solutions-postgres-1 psql -U aitek -d aitek_portal -tAc "SELECT COUNT(*) FROM users;" 2>$null).Trim()
if ($Reseed -or [string]::IsNullOrEmpty($userCount) -or $userCount -eq "0") {
    Write-Host "Seeding database..." -ForegroundColor Cyan
    docker compose @ComposeFlags run --rm -e ADMIN_EMAIL=$AdminEmail api npm run seed
    if ($LASTEXITCODE -ne 0) { throw "Seed failed" }
} else {
    Write-Host "Skipping seed ($userCount users already in DB)." -ForegroundColor DarkGray
}

Write-Host "Starting api + web (watch mode)..." -ForegroundColor Cyan
docker compose @ComposeFlags up -d api web
if ($LASTEXITCODE -ne 0) { throw "Failed to start api/web" }

Write-Host ""
Write-Host "Hot-reload stack is up:" -ForegroundColor Green
Write-Host "  web -> http://localhost:3000   (edits to apps/web reload automatically)"
Write-Host "  api -> http://localhost:3001/api/v1   (edits to apps/api restart on save)"
Write-Host ""
Write-Host "Tail logs:" -ForegroundColor DarkGray
Write-Host "  docker logs -f portal-aitek-solutions-web-1"
Write-Host "  docker logs -f portal-aitek-solutions-api-1"
