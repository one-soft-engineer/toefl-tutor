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
# Requirements:
#   - turso CLI installed and logged in (`turso auth login`)
#   - sqlite3 available (ships with macOS)
#
# Usage:
#   pnpm db:sync                 # syncs to db named "toefl-tutor"
#   TURSO_DB_NAME=other pnpm db:sync
#
set -euo pipefail

DB_NAME="${TURSO_DB_NAME:-toefl-tutor}"
LOCAL_DB="${LOCAL_DB_PATH:-local.db}"

if [ ! -f "$LOCAL_DB" ]; then
  echo "error: $LOCAL_DB not found (run from the project root)" >&2
  exit 1
fi

if ! command -v turso >/dev/null 2>&1; then
  echo "error: turso CLI not installed — see DEPLOY.md" >&2
  exit 1
fi

echo "Syncing $LOCAL_DB -> Turso db '$DB_NAME' (clean reload)..."

# Build one script: turn FK enforcement off, DROP every user table, then load
# the full schema+data dump. Piping in a single connection keeps the pragma and
# the drops on the same session, so FK constraints can't block the reload.
{
  echo "PRAGMA foreign_keys=OFF;"
  sqlite3 "$LOCAL_DB" \
    "select 'DROP TABLE IF EXISTS \"' || name || '\";' \
     from sqlite_master where type='table' and name not like 'sqlite_%';"
  sqlite3 "$LOCAL_DB" .dump
} | turso db shell "$DB_NAME"

echo "Done. Verifying row counts:"
turso db shell "$DB_NAME" \
  "select 'questions', count(*) from questions \
   union all select 'attempts', count(*) from attempts \
   union all select 'wrong_words', count(*) from wrong_words \
   union all select 'card_progress', count(*) from card_progress;"
