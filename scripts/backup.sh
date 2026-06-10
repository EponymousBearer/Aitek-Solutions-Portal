#!/usr/bin/env bash
# Back up the AiTek portal's persistent state: uploaded documents (local disk)
# AND the Postgres database. You need BOTH to restore — Postgres holds the
# Document metadata rows, the disk holds the actual file bytes.
#
# Produces two timestamped archives in BACKUP_DIR and prunes anything older
# than RETENTION_DAYS. Everything runs through docker, so the script needs only
# docker access — no sudo, and no host read-perms on the root-owned storage
# files.
#
#   ./scripts/backup.sh
#
# Env (all optional):
#   BACKUP_DIR       where archives are written (default /home/projects/aitek-backups)
#   RETENTION_DAYS   prune backups older than this many days (default 14)
#   REMOTE_DEST      if set, rsync the whole backup dir here after each run
#                    (e.g. user@host:/backups/aitek) — needs key-based ssh.
#                    OFF-BOX copies are what actually protect you if the VPS dies.
#
# --- Install as a nightly cron job (run as root so docker + file perms line up) ---
#   sudo crontab -e
# then add:
#   0 3 * * * cd /home/projects/aitek-portal && /usr/bin/env bash scripts/backup.sh >> /var/log/aitek-backup.log 2>&1
#
# (3am daily. Adjust the path if the repo lives elsewhere. Check it ran with:
#   tail -n 40 /var/log/aitek-backup.log )
set -euo pipefail

# Run from the repo root regardless of where the script was invoked from.
cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"

BACKUP_DIR="${BACKUP_DIR:-/home/projects/aitek-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

# --- Postgres ---
# Read DB name/user from .env, falling back to the compose defaults.
PG_USER="$(grep -E '^POSTGRES_USER=' .env 2>/dev/null | tail -1 | cut -d= -f2- || true)"
PG_DB="$(grep -E '^POSTGRES_DB=' .env 2>/dev/null | tail -1 | cut -d= -f2- || true)"
PG_USER="${PG_USER:-aitek}"
PG_DB="${PG_DB:-aitek_portal}"

DB_FILE="$BACKUP_DIR/db-$STAMP.sql.gz"
echo "→ Dumping Postgres database '$PG_DB' ..."
docker compose exec -T postgres pg_dump -U "$PG_USER" "$PG_DB" | gzip > "$DB_FILE"
echo "✓ $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"

# --- Documents (local disk storage) ---
DOCS_FILE="$BACKUP_DIR/storage-$STAMP.tar.gz"
if [ -d "$REPO_ROOT/storage" ] && [ -n "$(ls -A "$REPO_ROOT/storage" 2>/dev/null || true)" ]; then
  echo "→ Archiving documents (storage/) ..."
  # tar inside a throwaway container so root-owned upload files are readable
  # without sudo. The archive is written straight into BACKUP_DIR.
  docker run --rm \
    -v "$REPO_ROOT/storage:/data:ro" \
    -v "$BACKUP_DIR:/backup" \
    alpine:3 tar czf "/backup/storage-$STAMP.tar.gz" -C /data .
  echo "✓ $DOCS_FILE ($(du -h "$DOCS_FILE" | cut -f1))"
else
  echo "• storage/ is empty — skipping documents archive"
fi

# --- Prune old local backups ---
echo "→ Pruning backups older than ${RETENTION_DAYS} days ..."
find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'db-*.sql.gz' -o -name 'storage-*.tar.gz' \) \
  -mtime "+${RETENTION_DAYS}" -print -delete || true

# --- Optional off-box mirror ---
if [ -n "${REMOTE_DEST:-}" ]; then
  echo "→ Mirroring backup dir to $REMOTE_DEST ..."
  rsync -az --delete "$BACKUP_DIR/" "$REMOTE_DEST/"
  echo "✓ Mirrored off-box"
fi

echo "✓ Backup complete ($STAMP)"
echo
echo "Restore cheatsheet:"
echo "  DB:   gunzip -c db-<stamp>.sql.gz | docker compose exec -T postgres psql -U $PG_USER $PG_DB"
echo "  Docs: docker run --rm -v $REPO_ROOT/storage:/data -v $BACKUP_DIR:/backup alpine:3 \\"
echo "          sh -c 'cd /data && tar xzf /backup/storage-<stamp>.tar.gz'"
