# Project Status Snapshot

_Last updated: 2026-07-04 (end of the gamification/XP session)._

## Where things stand

The app is a single-user TOEFL "Complete the Words" trainer: Claude Code authors
questions locally into `local.db`, you practise them, and a review-only cloud
site (Vercel + Turso) lets you re-do them and drill missed words as flashcards.

Latest shipped feature: **Gamification / XP system (v1)** — PR #38, issue #37,
live on `main` (production).

## Recently completed

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
