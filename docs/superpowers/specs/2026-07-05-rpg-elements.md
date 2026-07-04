# RPG Elements — Spec (v1)

**Date:** 2026-07-05
**Goal:** Add role-playing-game flavor to the existing XP/level system so leveling
feels immersive and identity-driven ("I am a growing character"), without turning
the vocabulary trainer into a distracting side-game.

## Decisions (from grilling)

1. **Core fantasy** — a **scholar / language adept** (academic fantasy). Leveling
   = growing "lore/mastery". No swords-and-monsters combat layer.
2. **Depth** — narrative reskin + a quest system + attribute display. **Excluded:**
   items/loot, currency, skill trees, equipment, functional unlocks (keeps the
   "symbolic growth, nothing gated" philosophy from the XP v1 spec).
3. **Rank ladder** — 8 named tiers, each spanning ~5 levels, top tier open-ended.
   Level number still visible within a rank. Derived purely from level (no storage).
4. **Level-up experience** — keep the existing toast; RPG-flavor the copy and show
   the new title on a rank-up. **No** click-to-dismiss ceremony overlay.
5. **Character sheet** — a new `/character` page: hero header + attributes + rank
   ladder + quests panel. (Subsumes the previously-deferred `/profile` dashboard.)
6. **Status bar** — level badge tinted by rank color; short title shown on `sm+`
   screens; whole bar links to `/character`; XP bar and streak unchanged.
7. **Quests** — **3 daily quests only** (no weekly for now), reset at Taipei
   midnight, reusing existing quality actions.
8. **Quest rewards** — each quest grants its own small XP bonus on completion
   (option A). Idempotency via daily-reset flags on `user_stats`; **no new table**.
9. **Avatar** — represented by a colored rank **badge/emblem** (CSS/emoji), NOT a
   drawn/evolving character portrait (art-asset burden deferred).

## Rank ladder (placeholder titles, tunable)

| Tier | Levels | Title | Color theme |
|------|--------|-------|-------------|
| 1 | 1–4   | Novice Reader      | slate/gray |
| 2 | 5–9   | Word Apprentice    | green |
| 3 | 10–14 | Lexicon Adept      | teal |
| 4 | 15–19 | Vocabulary Scholar | blue |
| 5 | 20–24 | Diction Savant     | indigo |
| 6 | 25–29 | Loremaster         | violet |
| 7 | 30–39 | Sage of Words      | amber |
| 8 | 40+   | Archmage of Lexicon| gold |

`rankFromLevel(level)` → `{ tier, title, colorKey, minLevel, nextLevel|null }`,
pure function in `src/lib/rank.ts`.

## Character sheet attributes (all derived from existing data, no new counters)

- **Mastery (詞彙修為)** = words in Leitner box 5 (`card_progress.box === MAX_BOX`).
- **In study (研習中)** = words with progress but not mastered (`box < MAX_BOX`).
- **Resolve (毅力)** = current streak / longest streak (`user_stats`).
- **Total mastery (總修為)** = `totalXp`.

## Daily quests (3, reset at Taipei midnight)

1. **Daily Drill (今日達標)** — earn 30 XP today (reuse `user_stats.todayXp`).
2. **New Acquisition (習得新知)** — first-acquire ≥1 new word today.
3. **Trial (應試)** — complete ≥1 question today.

Each grants a small bonus XP (~10) once per day on completion. Bonus XP accrues
normally (adds to `totalXp`/`todayXp`).

**Data model (no new table):** add daily-reset fields to `user_stats`:
`newWordsToday` (int, +1 on first-acquisition), and per-quest claimed flags (a
small bitmask or three booleans) so a bonus is granted exactly once per day.
Questions-completed-today is derivable from `question_progress` (`last_xp_date`
== today) but the claimed flag still lives on `user_stats`. All reset on the same
Taipei day-rollover already implemented in `applyXp`.

## Out of scope (v1)

Weekly quests, combat/monsters, drawn/evolving avatar, items/loot/currency/skill
trees, functional unlocks, sound, rank-up overlay ceremony, leaderboards.
