#!/usr/bin/env bash
#
# Daily auto-author: have headless Claude Code write one fresh practice question,
# register it into local.db, then sync to the cloud Turso database.
#
# Designed to be run unattended (e.g. from launchd). It is safe: if Claude does
# not produce a new, schema-valid question file, it aborts BEFORE touching the
# cloud, so a bad run never corrupts the live site.
#
# Requirements: claude CLI logged in, turso CLI logged in, pnpm, sqlite3.
#
# Usage:  pnpm daily:question     (or)     bash scripts/daily-question.sh
#
set -euo pipefail

# launchd/cron start with a bare PATH. Prepend the dirs holding our tools
# (volta shims for node/pnpm/claude, homebrew for turso) so the script is
# self-sufficient no matter how it's launched.
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Resolve project root from this script's location so launchd can run it anywhere.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DATE="$(date +%F)"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "Daily question run for $DATE starting in $ROOT"

# Newest question file before generation, to detect whether Claude added one.
before="$(ls -t questions/*.json 2>/dev/null | head -1 || true)"

PROMPT="You are authoring ONE new TOEFL iBT 2026 Reading 'Complete the Words' practice question for a single-user study app.

Write exactly one new file at: questions/${DATE}-<topic-slug>.json
where <topic-slug> is a short lowercase hyphenated form of the topic (e.g. 'ocean-currents').

First run: list the existing files in questions/ and read a few, so you DO NOT repeat a topic that already exists. Pick a fresh, concrete academic topic (science, history, nature, technology, the arts).

The file MUST be valid JSON in exactly this shape:
{
  \"topic\": \"<Human Readable Topic>\",
  \"source\": \"${DATE}-<topic-slug>\",
  \"passage\": \"<a coherent ~70-90 word academic paragraph where each target word is replaced by the literal sentinel {} in reading order>\",
  \"blanks\": [
    { \"index\": 0, \"shown\": \"<first 2-4 letters of the answer>\", \"answer\": \"<full word, American spelling>\", \"hint\": \"<short synonym or gloss>\", \"example\": \"<one short sentence using the word naturally>\" }
  ]
}

Hard rules (the import script enforces these and will reject the file otherwise):
1. The number of {} sentinels in the passage MUST equal the number of items in blanks.
2. For every blank, answer (lowercased) MUST start with shown (lowercased).
3. blanks are in the same order as the {} appear; index counts 0,1,2,...
4. Use 8-10 blanks. Vary part of speech (nouns, verbs, adjectives).
5. The 'example' sentence MUST NOT contain the answer word itself or an obvious form of it.
6. American spelling. Keep hints and examples short.

Write ONLY that one file. Do not modify any other file. Do not run any commands."

log "Invoking Claude to author the question..."
# Retry transient failures (e.g. 529 Overloaded) with backoff: 0s, 60s, 180s, 300s.
attempt=0
max_attempts=4
backoff=(0 60 180 300)
until claude -p "$PROMPT" \
        --permission-mode acceptEdits \
        --allowedTools Read Glob Grep Write \
        >/tmp/toefl-daily-claude.log 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$max_attempts" ]; then
    log "ERROR: claude failed after ${max_attempts} attempts (see /tmp/toefl-daily-claude.log)"
    tail -3 /tmp/toefl-daily-claude.log | sed 's/^/[claude] /'
    exit 1
  fi
  wait_s="${backoff[$attempt]}"
  log "claude attempt ${attempt} failed; retrying in ${wait_s}s..."
  sleep "$wait_s"
done

after="$(ls -t questions/*.json 2>/dev/null | head -1 || true)"
if [ -z "$after" ] || [ "$after" = "$before" ]; then
  log "ERROR: no new question file was created — aborting before sync."
  exit 1
fi
log "New question file: $after"

# Register newest file into local.db (validates schema + sentinel count).
log "Registering into local.db..."
pnpm db:add

# Push local.db up to Turso (clean reload).
log "Syncing to Turso..."
pnpm db:sync

log "Daily question run complete."
