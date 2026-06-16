# TOEFL Complete-the-Words Tutor

Single-user tool for practising the TOEFL iBT 2026 Reading "Complete the Words"
task. Claude Code authors questions locally as JSON; you practise them in a
TOEFL-style exam UI; graded attempts are stored in a database so you can review
which words you've learned and which you got wrong.

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
                    /review · /words · /wrong-words
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
Requires the `turso` CLI logged in (`turso auth login`); override the target
with `TURSO_DB_NAME=<name> pnpm db:sync`.

### Automating it (optional)

`pnpm db:sync` is the one command you need; for a hands-off refresh schedule it
with macOS `launchd` (only runs while the Mac is awake):

```bash
# ~/Library/LaunchAgents/com.toefl-tutor.dbsync.plist runs `pnpm db:sync`
# nightly. See DEPLOY.md → "Refreshing content later" for the ready-made plist.
launchctl load ~/Library/LaunchAgents/com.toefl-tutor.dbsync.plist
```

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
