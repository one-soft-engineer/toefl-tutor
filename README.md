# TOEFL Complete-the-Words Tutor

Single-user tool for practising the TOEFL iBT 2026 Reading "Complete the Words"
task. Claude Code authors questions locally as JSON; you practise locally with
auto-grading; results sync to a Vercel + Neon cloud practice site behind GitHub
OAuth.

## How it works

```
Claude Code → questions/*.json → local practice (next dev) → grade locally
                                        │ auto-upload on submit
                                        ▼
        /api/local-sync (server proxy, holds UPLOAD_TOKEN)
                                        │
                                        ▼
   Vercel: /api/results → Neon Postgres → /review, /wrong-words (GitHub OAuth)
```

## Local authoring & practice

1. `cp .env.local.example .env.local` and set:
   - `LOCAL_MODE=1`
   - `RESULTS_ENDPOINT` — your deployed `/api/results` URL
   - `UPLOAD_TOKEN` — same value as the deployed app
2. Ask Claude Code to write questions into `questions/*.json`. See
   `questions/2026-06-08-example.json` for the format: a ~70-word passage where
   each blank is written as the sentinel `{}` (in reading order), and a
   matching ordered `blanks` array giving the leading letters (`shown`) and the
   full American-spelling `answer`. The app renders each blank as the `shown`
   letters followed by an input sized to the number of missing letters.
3. `LOCAL_MODE=1 pnpm dev` and open http://localhost:3000.
4. Pick a question, fill in the missing letters, and submit. You are graded
   locally and the result is auto-synced to the cloud.

Local question files are gitignored (`/questions/*.json`); they live in the
cloud database after syncing.

## Cloud deploy (Vercel)

1. Create a Neon Postgres database; set `DATABASE_URL`.
2. `pnpm db:push` to create the tables.
3. Create a GitHub OAuth app; set `GITHUB_ID`, `GITHUB_SECRET`, and callback
   URL `https://<app>/api/auth/callback/github`.
4. Set `ALLOWED_GITHUB_LOGIN` (your GitHub username), `AUTH_SECRET`,
   `UPLOAD_TOKEN` (same as local). `AUTH_URL` is auto-detected on Vercel.
5. Do **not** set `LOCAL_MODE` in production — that keeps the local authoring
   routes disabled and enables the OAuth gate.
6. Deploy. Visit `/review` and sign in with GitHub; only `ALLOWED_GITHUB_LOGIN`
   is allowed in.

## Environment variables

| Variable | Used by | Notes |
|----------|---------|-------|
| `LOCAL_MODE` | local | `1` enables local authoring/practice routes |
| `RESULTS_ENDPOINT` | local | deployed `/api/results` URL |
| `UPLOAD_TOKEN` | local + cloud | Bearer token for `/api/results` |
| `DATABASE_URL` | cloud | Neon Postgres connection string |
| `GITHUB_ID` / `GITHUB_SECRET` | cloud | GitHub OAuth app credentials |
| `ALLOWED_GITHUB_LOGIN` | cloud | the single allowed GitHub username |
| `AUTH_SECRET` | cloud | Auth.js v5 session secret |
| `AUTH_URL` | cloud | optional on Vercel (auto-detected) |

## Tests

This project uses [pnpm](https://pnpm.io). CI (`.github/workflows/ci.yml`) runs
typecheck, lint, test, and build on every push and pull request.

```bash
pnpm install
pnpm test          # unit tests (grading, schema, loader, ingestion)
pnpm typecheck
pnpm lint
pnpm build
```
