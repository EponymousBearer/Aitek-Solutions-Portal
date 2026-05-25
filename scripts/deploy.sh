#!/usr/bin/env bash
# Deploy the AiTek dev environment on the Hostinger VPS.
#
# Syncs the repo to the target branch, rebuilds the production images, applies
# database migrations, and restarts the stack. Safe to run by hand or from CI
# (.github/workflows/deploy-dev.yml calls it over SSH).
#
#   cd /opt/aitek-portal && ./scripts/deploy.sh          # deploys origin/dev
#   ./scripts/deploy.sh main                             # or another branch
#
# Expects: docker + docker compose available without sudo, and /opt/aitek-portal/.env
# present (see planning/23-live-dev-deployment-guide.md, Phase 6).
set -euo pipefail

BRANCH="${1:-dev}"

# Run from the repo root regardless of where the script was invoked from.
cd "$(dirname "$0")/.."

echo "→ Syncing to origin/${BRANCH} ..."
git fetch origin "${BRANCH}"
git checkout -f "${BRANCH}"
git reset --hard "origin/${BRANCH}"

# Build sequentially — concurrent `npm ci` on the VPS triggers transient
# ECONNRESET failures (see planning/23). No target => production `runner` stage.
echo "→ Building api image ..."
docker compose build api
echo "→ Building web image ..."
docker compose build web

echo "→ Applying database migrations ..."
docker compose run --rm migrate

echo "→ Restarting services ..."
docker compose up -d --remove-orphans

echo "→ Status:"
docker compose ps
echo "✓ Deploy complete (branch: ${BRANCH})"
