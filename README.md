# TOEFL Complete-the-Words Tutor

Single-user tool for practising the TOEFL iBT 2026 Reading "Complete the Words"
task. Claude Code authors questions locally as JSON; you practise them in a
TOEFL-style exam UI against a countdown timer; graded attempts are stored in a
database so you can review which words you've learned and drill the ones you
missed as spaced-repetition (Leitner) flashcards.

Highlights:

- **Timed exam UI** — TOEFL-style shell with a countdown; the cloud review page
  is a timed re-do (graded in the browser, never written back).
- **Spaced-repetition flashcards** — missed words feed a Leitner box schedule.
- **Daily auto-authored questions** — an optional scheduled job has headless
  Claude Code write a fresh question each day and push it live.

The same codebase runs two ways, with a single Drizzle (libSQL/SQLite) schema:

- **Local** (`pnpm dev`, `LOCAL_MODE=1`): data lives in a SQLite file
  (`local.db`). No external service, works offline.
- **Cloud** (Vercel): data lives in [Turso](https://turso.tech) (libSQL over
  HTTP), behind a GitHub OAuth gate that allows only your account.

## How it works

```
Claude Code → questions/*.json → practice (TOEFL-style exam UI) → grade locally
                                        │ POST /api/results
                                        ▼
                        Drizzle + libSQL  (file:local.db | Turso)
                                        │
                                        ▼
                    /review · /words · /flashcards
```

## Local authoring & practice

1. `cp .env.local.example .env.local` and set `LOCAL_MODE=1` (Turso vars can stay
   unset — the app falls back to `file:local.db`).
2. `pnpm db:push` to create the tables in `local.db`.
3. Ask Claude Code to write questions into `questions/*.json`. See
   `questions/2026-06-08-example.json` for the format: a ~70-word passage where
   each blank is written as the sentinel `{}` (in reading order), and a matching
   ordered `blanks` array giving the leading letters (`shown`) and the full
   American-spelling `answer`.
4. `LOCAL_MODE=1 pnpm dev` and open http://localhost:3000.

Local question files and `local.db` are gitignored.

## Cloud deploy (Vercel)

1. Add the **Turso Cloud** integration from the Vercel Marketplace and create a
   database; it sets `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` automatically.
2. `pnpm db:push` against the Turso database to create the tables.
3. Create a GitHub OAuth app; set `GITHUB_ID`, `GITHUB_SECRET`, and callback URL
   `https://<app>/api/auth/callback/github`.
4. Set `ALLOWED_GITHUB_LOGIN` (your GitHub username) and `AUTH_SECRET`.
   `AUTH_URL` is auto-detected on Vercel.
5. Do **not** set `LOCAL_MODE` in production — that enables the OAuth gate and
   the cloud database.
6. Deploy. Visit `/review` and sign in with GitHub; only logins in
   `ALLOWED_GITHUB_LOGIN` are allowed in.

## Refreshing cloud content (review-only)

The deployed site is **review-only**: it reads from Turso and never writes. New
questions are always authored and practised **locally** (they land in `local.db`).
To make them appear online you push `local.db` into Turso:

```bash
pnpm db:sync
```

`scripts/db-sync.sh` does a **clean reload** — it dumps `local.db`, drops every
table on Turso, and recreates them from the dump, so rows never collide on
primary keys. It re-reads `local.db`, so you can run it as often as you like.

Auth uses a **long-lived Turso DB token** (not the `turso` CLI login, whose
session expires and would silently break unattended runs). Put the credentials
in `.env.sync` (gitignored — kept separate from `.env.local` so `pnpm dev`
still uses `file:local.db`):

```bash
# one-time: turso auth login, then
echo "TURSO_DATABASE_URL=$(turso db show toefl-tutor --url)"  >> .env.sync
echo "TURSO_AUTH_TOKEN=$(turso db tokens create toefl-tutor)" >> .env.sync
```

The sync fails loudly (non-zero exit) if the token is missing or the push
errors, so the daily job won't silently no-op.

### Daily auto-authored questions (optional)

To grow the question bank hands-off, a scheduled job has headless Claude Code
write one fresh question each day and push it live:

```bash
pnpm daily:question   # author 1 question -> local.db -> Turso, in one shot
```

`scripts/daily-question.sh` invokes `claude -p` to author a non-duplicate
question, registers it with `pnpm db:add` (which inserts a `questions` row
without needing a practice attempt, and validates the schema + `{}`-per-blank
invariant), then runs `pnpm db:sync`. If Claude produces nothing valid the run
aborts before touching Turso. Schedule it daily with the ready-made launchd
plist (only runs while the Mac is awake):

```bash
cp scripts/com.toefl-tutor.dailyquestion.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.toefl-tutor.dailyquestion.plist
```

See DEPLOY.md → "Daily auto-authored questions" for details and how to change
the time or stop it.

## Environment variables

| Variable | Used by | Notes |
|----------|---------|-------|
| `LOCAL_MODE` | local | `1` enables local routes and the `local.db` SQLite file |
| `TURSO_DATABASE_URL` | cloud | Turso libSQL URL (set by the Vercel integration) |
| `TURSO_AUTH_TOKEN` | cloud | Turso auth token (set by the Vercel integration) |
| `GITHUB_ID` / `GITHUB_SECRET` | cloud | GitHub OAuth app credentials |
| `ALLOWED_GITHUB_LOGIN` | cloud | allowed GitHub username(s); comma-separate for several, e.g. `alice,bob` |
| `AUTH_SECRET` | cloud | Auth.js v5 session secret |
| `AUTH_URL` | cloud | optional on Vercel (auto-detected) |

## Tests

This project uses [pnpm](https://pnpm.io). CI (`.github/workflows/ci.yml`) runs
typecheck, lint, test, and build on every push and pull request.

```bash
pnpm install
pnpm test          # unit tests (grading, schema, loader, ingestion, helpers)
pnpm typecheck
pnpm lint
pnpm build
```
