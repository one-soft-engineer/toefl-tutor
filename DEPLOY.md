# Deploying TOEFL Tutor to Vercel

This app runs in two modes:

- **Local mode** (`LOCAL_MODE=1`): authoring + taking practice, data in `local.db`. No auth.
- **Cloud mode** (Vercel): **review only** — `/review`, `/words`, `/flashcards`. The
  practice/authoring pages redirect away. Data comes from a **Turso** database and the
  whole site is behind a **GitHub OAuth** gate that only lets your account in.

New questions are always authored **locally** (they live in gitignored JSON and enter
`local.db` when you practice). To put them online you seed/refresh Turso from `local.db`
(see step 1 and the "Refreshing content" section).

---

## Prerequisites

- A GitHub account (`one-soft-engineer`) — already the repo owner.
- A free [Turso](https://turso.tech) account.
- A free [Vercel](https://vercel.com) account.
- The repo pushed to GitHub (`one-soft-engineer/toefl-tutor`) — done.

---

## Step 1 — Create and seed the Turso database

Install the CLI and log in (run these in your own terminal; in this session prefix with `!`):

```bash
brew install tursodatabase/tap/turso     # macOS
turso auth login                         # opens browser
```

Create the database **seeded directly from your local.db** (copies schema + all your
questions, attempts, wrong words and flashcard progress in one shot):

```bash
cd /Users/chuan/Projects/toefl-tutor
turso db create toefl-tutor --from-file ./local.db
```

> Alternative if `--from-file` gives trouble: create an empty db, push the schema with
> `TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... pnpm db:push`, then
> `turso db shell toefl-tutor < turso-seed.sql`.

Grab the two values you'll need as env vars:

```bash
turso db show toefl-tutor --url          # -> TURSO_DATABASE_URL  (libsql://...)
turso db tokens create toefl-tutor       # -> TURSO_AUTH_TOKEN    (long token)
```

Keep both somewhere safe for step 4.

---

## Step 2 — First deploy on Vercel (to get your URL)

1. Go to <https://vercel.com/new>, **Import** `one-soft-engineer/toefl-tutor`.
2. Framework preset: **Next.js** (auto-detected). Leave build/output settings default.
3. Click **Deploy**. The build will succeed, but the site will error until env vars are
   set (that's expected — do steps 3–4 next).
4. Note your production URL, e.g. `https://toefl-tutor.vercel.app`. Call it `APP_URL`.

---

## Step 3 — Create the GitHub OAuth app

1. Go to <https://github.com/settings/developers> → **New OAuth App**.
2. Fill in:
   - **Application name:** TOEFL Tutor
   - **Homepage URL:** `APP_URL` (e.g. `https://toefl-tutor.vercel.app`)
   - **Authorization callback URL:** `APP_URL/api/auth/callback/github`
     (e.g. `https://toefl-tutor.vercel.app/api/auth/callback/github`)
3. **Register application** → copy the **Client ID**.
4. **Generate a new client secret** → copy it (shown once).

---

## Step 4 — Set environment variables in Vercel

Project → **Settings → Environment Variables** (scope: **Production**). Add:

| Name | Value |
|------|-------|
| `TURSO_DATABASE_URL` | from step 1 (`libsql://...`) |
| `TURSO_AUTH_TOKEN`   | from step 1 |
| `GITHUB_ID`          | OAuth Client ID from step 3 |
| `GITHUB_SECRET`      | OAuth Client Secret from step 3 |
| `ALLOWED_GITHUB_LOGIN` | `one-soft-engineer` (comma-separate to allow more, e.g. `one-soft-engineer,chienchuanw`) |
| `AUTH_SECRET`        | a random string — generate with `openssl rand -base64 32` |
| `AUTH_URL`           | `APP_URL` (e.g. `https://toefl-tutor.vercel.app`) |

Do **not** set `LOCAL_MODE` in Vercel. If sign-in throws a host error, also add
`AUTH_TRUST_HOST=true`.

---

## Step 5 — Redeploy and verify

1. Vercel → **Deployments** → latest → **Redeploy** (so it picks up the env vars).
2. Open `APP_URL`. You'll be redirected to **Sign in with GitHub**.
3. Sign in with `one-soft-engineer` (any other account is rejected by design).
4. You should see **Review / Words / Flashcards** populated with your seeded data.

---

## Refreshing content later

The deployed site is read-only. When you author/practice new questions locally and want
them online, push your updated `local.db` into Turso with one command:

```bash
pnpm db:sync
```

`scripts/db-sync.sh` does a **clean reload** (dump `local.db` → drop every table on
Turso → recreate from the dump), so it's safe to run repeatedly and rows never collide on
primary keys. It needs the `turso` CLI logged in (`turso auth login`). Override the target
database with `TURSO_DB_NAME=<name> pnpm db:sync`.

> Manual fallback if you can't run the script:
> ```bash
> sqlite3 local.db .dump > turso-seed.sql
> turso db destroy toefl-tutor && turso db create toefl-tutor --from-file ./local.db
> ```

## Daily auto-authored questions (macOS)

A scheduled job has headless Claude Code write one fresh question each day and push it
live, so the cloud site gains a new question daily with no manual work:

```bash
pnpm daily:question
```

`scripts/daily-question.sh` runs the full chain:

1. Invoke `claude -p` (retrying transient 529s) to author a new, non-duplicate
   `questions/<date>-<topic>.json` matching the schema.
2. `pnpm db:add` — register the newest file into `local.db` (validates schema **and**
   the `{}`-per-blank invariant; aborts the whole run if Claude produced nothing valid,
   so a bad day never reaches the cloud).
3. `pnpm db:sync` — clean-reload `local.db` into Turso.

It needs the `claude` and `turso` CLIs logged in. Logs go to
`~/Library/Logs/toefl-tutor-daily.log`.

### Schedule it with launchd

A ready-made plist lives at `scripts/com.toefl-tutor.dailyquestion.plist` (runs daily at
08:00 local). Install once:

```bash
cp scripts/com.toefl-tutor.dailyquestion.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.toefl-tutor.dailyquestion.plist
launchctl list | grep toefl-tutor          # confirm it's registered
```

Change the time via `StartCalendarInterval` (local machine time). It only runs while the
Mac is awake; a job missed while asleep runs at the next wake. Stop it with:

```bash
launchctl unload ~/Library/LaunchAgents/com.toefl-tutor.dailyquestion.plist
```

> Just want a manual cloud refresh (no authoring)? Run `pnpm db:sync` on its own — see
> "Manual fallback" above. `launchd` is preferred over `cron` on modern macOS.
