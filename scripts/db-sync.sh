#!/usr/bin/env bash
#
# Sync the local SQLite database (local.db) into the cloud Turso database.
#
# The deployed site is REVIEW-ONLY and reads from Turso, so new questions you
# author/practice locally only appear online after running this.
#
# It does a clean reload: every table present in local.db is dropped on Turso
# and recreated from a fresh dump, so rows never collide on primary keys.
#
# Auth: uses a long-lived Turso DB token (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN)
# via @libsql/client — NOT the `turso` CLI login, whose session expires and
# silently broke this job. Put the two vars in .env.sync (gitignored). Create
# them once with:
#   turso db show toefl-tutor --url          # -> TURSO_DATABASE_URL
#   turso db tokens create toefl-tutor       # -> TURSO_AUTH_TOKEN
#
# NB: these vars live in .env.sync, NOT .env.local, so `pnpm dev` keeps using
# file:local.db instead of talking to the cloud.
#
# Requirements: node, sqlite3 (ships with macOS).
#
# Usage:
#   pnpm db:sync
#
set -euo pipefail

LOCAL_DB="${LOCAL_DB_PATH:-local.db}"

# Resolve project root so it works under launchd / any CWD.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Load sync credentials (kept out of .env.local on purpose — see header).
if [ -f .env.sync ]; then
  set -a; . ./.env.sync; set +a
fi

if [ ! -f "$LOCAL_DB" ]; then
  echo "error: $LOCAL_DB not found (run from the project root)" >&2
  exit 1
fi

if [ -z "${TURSO_DATABASE_URL:-}" ] || [ -z "${TURSO_AUTH_TOKEN:-}" ]; then
  echo "error: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN not set — create .env.sync (see header / DEPLOY.md)" >&2
  exit 1
fi

echo "Syncing $LOCAL_DB -> Turso (clean reload)..."

# Build one script: FK off, DROP every user table child-first (reverse creation
# order, so foreign keys can't block the drop), then load the full dump.
{
  echo "PRAGMA foreign_keys=OFF;"
  sqlite3 "$LOCAL_DB" \
    "select 'DROP TABLE IF EXISTS \"' || name || '\";' \
     from sqlite_master where type='table' and name not like 'sqlite_%' \
     order by rowid desc;"
  sqlite3 "$LOCAL_DB" .dump
} | node scripts/db-sync.mjs

echo "Done."
