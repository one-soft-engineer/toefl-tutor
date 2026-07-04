# Project Status Snapshot

_Last updated: 2026-07-04 (end of the gamification/XP session)._

## Where things stand

The app is a single-user TOEFL "Complete the Words" trainer: Claude Code authors
questions locally into `local.db`, you practise them, and a review-only cloud
site (Vercel + Turso) lets you re-do them and drill missed words as flashcards.

Latest shipped: **Gamification XP balance v1.1** — PR #40, issue #39, live on
`main` (production). Builds on the v1 system (PR #38, issue #37).

## Recently completed

- **XP balance v1.1** (PR #40):
  - Question completion on cloud `/review` now awards XP (`correct*3 + 10 full
    marks`), capped once per question per Taipei-day via a cloud-authoritative
    `question_progress` table. New `POST /api/questions/complete`, wired through
    `CompleteTheWords` `onGraded` in `ReviewClient` (toast + status-bar refresh).
    The daily slot is spent only when XP is actually awarded (a 0-score submit
    doesn't lock out a later real attempt).
  - Rebalanced `xpForReview`: recognition `5+box`, production `5+box+12`, plus a
    one-time `+8` first-acquisition bonus, so a newly-learned word (15) beats
    re-reviewing a mastered one (10).
  - Daily goal stays 30 XP, now reliably reachable via question XP.
  - Design docs: `docs/superpowers/{specs,plans}` (v1); this increment tracked
    via issue #39 / PR #40.

## Recently completed (v1)

- **Gamification v1** (PR #38):
  - Quality-bound XP on flashcard review (box-scaled; Production > Recognition;
    "Again" = 0; one award per word per day via `card_progress.lastReviewedAt`).
  - Level curve + streak with a weekly one-day freeze (pure, unit-tested logic
    in `src/lib/xp.ts`, `src/lib/streak.ts`, Taipei helpers in `src/lib/time.ts`).
  - Cloud-authoritative single-row `user_stats` table + `src/lib/stats-store.ts`.
  - Persistent `StatusBar` (level / XP / streak) + in-the-moment "+X XP" toast.
  - **Sync contract fix:** `db:sync` now reloads only content tables
    (`questions`, `attempts`); progress tables (`card_progress`, `wrong_words`,
    `user_stats`) are never overwritten — fixes a latent daily-wipe bug.
  - Design docs: `docs/superpowers/specs/2026-07-04-gamification-xp.md`,
    `docs/superpowers/plans/2026-07-04-gamification-xp.md`.

## Deferred (v2 candidates)

- XP for the timed full-question `/review` re-do (currently persists nothing).
- `/profile` dashboard: milestone badge wall, activity heatmap, mastery curve.
- Achievements/badges, sound effects, larger level-up celebration.
- Optional hardening: make the `user_stats` read-modify-write atomic
  (transaction / `UPDATE ... total_xp = total_xp + ?`) to close a concurrent-
  review race — low priority under single-user scope.

## Ops notes

- Production `user_stats` table was created on Turso via `pnpm db:push`
  (required before the review route, which reads it unguarded, went live).
- Verification gate for changes: `pnpm typecheck && pnpm lint && pnpm test &&
  pnpm build` (62 unit tests currently).
