# Gamification / XP System — Spec (v1)

**Date:** 2026-07-04
**Goal:** Make the app feel game-like and growth-oriented — an XP/level system,
daily streaks, and immediate feedback — so the single user (me) is willing to
spend more time drilling vocabulary and feels progress instead of boredom.

## Decisions (from grilling)

1. **Venue / persistence** — The **cloud** (Vercel) site is the real study
   venue. Gamification state must persist there. Progress lives only in the
   cloud and is never overwritten by `db:sync`.
2. **Users** — Single person. Both allowed GitHub logins are the same human.
   XP is **global / single-row**. No `userLogin` column, no leaderboard,
   no multi-user logic.
3. **XP is quality-bound, not click-bound** — XP rewards turning "don't know"
   into "know" and using words, never mindless clicking.
4. **Growth is symbolic (option A)** — Levels are a flattering wrapper around
   *real* learning outcomes (mastered words, streak, volume). Levels never gate
   functionality; nothing is artificially locked to be "unlocked".
5. **Retention** — **Daily XP goal + consecutive-day streak + one weekly
   forgiveness (freeze)**. A single missed day can be bridged once per week
   instead of resetting the streak to zero.
6. **Surface** — A persistent top **status bar** (level badge + XP progress bar
   + 🔥 streak) plus **restrained in-the-moment "+X XP" feedback** while
   studying. A full dashboard/`/profile` and badge wall are deferred to v2.
7. **Sync contract** — `db:sync` overwrites only **content** tables
   (`questions`, `attempts`); **progress** tables (`card_progress`,
   `wrong_words`, `user_stats`) are cloud-authoritative and never touched. This
   also fixes an existing latent bug where daily sync silently wiped the
   cloud's flashcard progress.
8. **Scope** — v1 = the closed loop above. v2 = dashboard, badges, sound,
   big level-up animations.

## XP sources (v1 — the flashcard loop, which is where cloud studying happens)

The cloud's only existing write path for study activity is
`POST /api/flashcards/review` (both Recognition and Production route through it).
v1 awards XP there:

- **Recognition "Got it"** (promotes Leitner box): XP scaled by the resulting
  box — higher box = more XP (rewards durable memory, not re-drilling easy
  words).
- **Production "Got it"** (Gemini judged the sentence ok): highest XP
  (production is the hardest, most valuable mode).
- **"Again"**: 0 XP (honest, not punished).
- **Anti-farming:** at most **one XP award per word per day**, enforced using
  the existing `card_progress.lastReviewedAt` column (a word already reviewed
  today earns 0). This is why no per-word daily counter table is needed —
  correctly-answered words also leave today's queue via Leitner scheduling.

**Explicitly deferred to v2:** awarding XP for the timed full-question `/review`
re-do. It currently persists nothing on the cloud (graded in-browser by design),
and the flashcard loop already covers the repetitive vocabulary drilling that
this feature targets.

## Constants

- `LEVEL_BASE = 100`, cumulative XP to reach level L = `50 · L · (L−1)`
  (L1=0, L2=100, L3=300, L4=600 …).
- `DAILY_GOAL_XP = 30`.
- `FREEZE_PER_WEEK = 1`.
- XP: `xpForReview` — again→0; recognition→`box·3`; production→`box·3 + 15`.
- Timezone for "today"/"week": **Asia/Taipei (UTC+8, no DST)**.

## Out of scope (v1)

Leaderboards, multi-user, unlockable content, `/profile` dashboard, badge/
achievement system, sound effects, question-review XP.
