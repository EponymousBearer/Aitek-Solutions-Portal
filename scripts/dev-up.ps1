#!/usr/bin/env pwsh
# Local-dev shortcut for the full docker stack.
#
# Usage:
#   .\scripts\dev-up.ps1            # build + start + migrate + seed if needed
#   .\scripts\dev-up.ps1 -SkipBuild # just start (no rebuild)
#   .\scripts\dev-up.ps1 -Reseed    # force re-run seed (idempotent)

param(
    [switch]$SkipBuild,
    [switch]$Reseed,
    [string]$AdminEmail = "info@aitek-solutions.com"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$ComposeFlags = @("-f", "docker-compose.yml", "-f", "docker-compose.local.yml")

if (-not $SkipBuild) {
    Write-Host "Building images..." -ForegroundColor Cyan
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

# Seed if the users table is empty OR -Reseed was passed
$userCount = (docker exec portal-aitek-solutions-postgres-1 psql -U aitek -d aitek_portal -tAc "SELECT COUNT(*) FROM users;" 2>$null).Trim()
if ($Reseed -or [string]::IsNullOrEmpty($userCount) -or $userCount -eq "0") {
    Write-Host "Seeding database..." -ForegroundColor Cyan
    # tsconfig.json in the runner extends a workspace package that isn't shipped
    # in the runtime image, so use --skipProject + inline compiler options.
    $seedCmd = "cd /app && /app/apps/api/node_modules/.bin/ts-node --transpile-only --skipProject --compiler-options '{`"module`":`"commonjs`",`"target`":`"es2020`",`"esModuleInterop`":true,`"resolveJsonModule`":true}' /app/prisma/seed.ts"
    docker compose @ComposeFlags run --rm -e ADMIN_EMAIL=$AdminEmail api sh -c $seedCmd
    if ($LASTEXITCODE -ne 0) { throw "Seed failed" }
} else {
    Write-Host "Skipping seed ($userCount users already in DB)." -ForegroundColor DarkGray
}

Write-Host "Starting api + web..." -ForegroundColor Cyan
docker compose @ComposeFlags up -d api web
if ($LASTEXITCODE -ne 0) { throw "Failed to start api/web" }

Write-Host ""
Write-Host "Stack is up:" -ForegroundColor Green
Write-Host "  web -> http://localhost:3000"
Write-Host "  api -> http://localhost:3001/api/v1"
Write-Host ""
Write-Host "Tail logs:" -ForegroundColor DarkGray
Write-Host "  docker logs -f portal-aitek-solutions-api-1"
Write-Host "  docker logs -f portal-aitek-solutions-web-1"
