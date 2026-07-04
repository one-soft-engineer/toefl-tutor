# Gamification / XP System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a quality-bound XP/level system, daily streaks with one weekly forgiveness, a persistent status bar, and in-the-moment "+X XP" feedback — so the single user spends more time drilling vocabulary on the cloud site.

**Architecture:** All scoring/streak logic lives in pure, unit-tested lib modules (`xp.ts`, `streak.ts`, time helpers). A single new cloud-authoritative `user_stats` row holds totals. The existing `POST /api/flashcards/review` route (the cloud's only study-write path) awards XP. A server `StatusBar` reads stats; the flashcard client shows toasts and calls `router.refresh()`. `db:sync` is narrowed to overwrite only content tables so progress is never wiped.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Drizzle ORM + @libsql/client (libSQL/Turso), Tailwind v4, Vitest.

## Global Constants (copied verbatim from spec — every task assumes these)

- Single user; XP is **global / single-row** (`user_stats.id = "singleton"`). No per-user column.
- `LEVEL_BASE = 100`; cumulative XP to reach level L = `50 · L · (L−1)`.
- `DAILY_GOAL_XP = 30`; `FREEZE_PER_WEEK = 1`.
- `xpForReview`: again→`0`; recognition→`box·3`; production→`box·3 + 15`.
- At most **one XP award per word per day** (via existing `card_progress.lastReviewedAt`).
- Timezone for day/week bucketing: **Asia/Taipei = UTC+8, no DST**.
- Sync contract: overwrite only `questions`, `attempts`; never touch `card_progress`, `wrong_words`, `user_stats`.
- Commit messages (subject AND body) must be in **English** (repo rule in CLAUDE.md).
- Verification gate for non-pure tasks: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` must be green.

## File Structure

- `src/lib/xp.ts` (create) — level curve + per-review XP amounts. Pure.
- `src/lib/streak.ts` (create) — `Stats` type + `applyXp` reducer (streak/goal/freeze). Pure.
- `src/lib/time.ts` (modify) — add `taipeiDate`, `taipeiYesterday`, `taipeiWeekKey`. Pure.
- `src/db/schema.ts` (modify) — add `userStats` table.
- `src/lib/stats-store.ts` (create) — thin Drizzle adapter: `getOrCreateStats`, `saveStats`.
- `src/app/api/flashcards/review/route.ts` (modify) — accept `mode`, award XP, extend response.
- `src/components/StatusBar.tsx` (create) — async server component: level badge + XP bar + streak.
- `src/app/layout.tsx` (modify) — mount `<StatusBar />` under `<TopNav>`.
- `src/app/flashcards/StudyClient.tsx` (modify) — send `mode`, show "+X XP" toast + level-up banner, `router.refresh()`.
- `scripts/db-sync.sh` + `scripts/db-sync.mjs` (modify) — content-table whitelist.
- `README.md` (modify) — document the progress/content sync split.
- Tests: `tests/xp.test.ts`, `tests/streak.test.ts`, `tests/time.test.ts` (extend).

---

### Task 1: XP curve + per-review XP amounts (`src/lib/xp.ts`)

**Files:**
- Create: `src/lib/xp.ts`
- Test: `tests/xp.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `LEVEL_BASE: number`, `DAILY_GOAL_XP: number`
  - `cumulativeXpForLevel(level: number): number`
  - `interface LevelInfo { level: number; xpIntoLevel: number; xpForNextLevel: number }`
  - `levelFromXp(totalXp: number): LevelInfo`
  - `type ReviewMode = "recognition" | "production"`
  - `xpForReview(input: { mode: ReviewMode; result: "got" | "again"; box: number }): number`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/xp.test.ts
import { describe, it, expect } from "vitest";
import {
  cumulativeXpForLevel,
  levelFromXp,
  xpForReview,
  DAILY_GOAL_XP,
} from "@/lib/xp";

describe("cumulativeXpForLevel", () => {
  it("is triangular: L1=0, L2=100, L3=300, L4=600", () => {
    expect(cumulativeXpForLevel(1)).toBe(0);
    expect(cumulativeXpForLevel(2)).toBe(100);
    expect(cumulativeXpForLevel(3)).toBe(300);
    expect(cumulativeXpForLevel(4)).toBe(600);
  });
});

describe("levelFromXp", () => {
  it("stays at level 1 below 100 xp", () => {
    expect(levelFromXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNextLevel: 100 });
    expect(levelFromXp(99)).toEqual({ level: 1, xpIntoLevel: 99, xpForNextLevel: 100 });
  });
  it("crosses to level 2 at exactly 100 xp", () => {
    expect(levelFromXp(100)).toEqual({ level: 2, xpIntoLevel: 0, xpForNextLevel: 200 });
  });
  it("reports progress within a level", () => {
    expect(levelFromXp(450)).toEqual({ level: 3, xpIntoLevel: 150, xpForNextLevel: 300 });
  });
});

describe("xpForReview", () => {
  it("gives nothing for 'again' regardless of mode/box", () => {
    expect(xpForReview({ mode: "recognition", result: "again", box: 5 })).toBe(0);
    expect(xpForReview({ mode: "production", result: "again", box: 3 })).toBe(0);
  });
  it("scales recognition XP by the resulting box", () => {
    expect(xpForReview({ mode: "recognition", result: "got", box: 2 })).toBe(6);
    expect(xpForReview({ mode: "recognition", result: "got", box: 5 })).toBe(15);
  });
  it("rewards production highest (box·3 + 15)", () => {
    expect(xpForReview({ mode: "production", result: "got", box: 2 })).toBe(21);
    expect(xpForReview({ mode: "production", result: "got", box: 5 })).toBe(30);
  });
  it("exposes the daily goal constant", () => {
    expect(DAILY_GOAL_XP).toBe(30);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/xp.test.ts`
Expected: FAIL — `Cannot find module '@/lib/xp'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/xp.ts

// Level curve: cumulative XP to REACH a level grows triangularly, so each level
// costs a bit more than the last (level 1 starts at 0 XP).
export const LEVEL_BASE = 100;

// XP needed to reach the daily goal (drives the streak).
export const DAILY_GOAL_XP = 30;

export function cumulativeXpForLevel(level: number): number {
  return (LEVEL_BASE / 2) * level * (level - 1);
}

export interface LevelInfo {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

export function levelFromXp(totalXp: number): LevelInfo {
  let level = 1;
  while (cumulativeXpForLevel(level + 1) <= totalXp) level++;
  const base = cumulativeXpForLevel(level);
  const next = cumulativeXpForLevel(level + 1);
  return { level, xpIntoLevel: totalXp - base, xpForNextLevel: next - base };
}

export type ReviewMode = "recognition" | "production";

// XP is quality-bound: nothing for "again"; higher Leitner boxes are worth more
// (durable memory), and production (writing a sentence) is worth the most.
export function xpForReview(input: {
  mode: ReviewMode;
  result: "got" | "again";
  box: number;
}): number {
  if (input.result === "again") return 0;
  const durability = input.box * 3;
  return input.mode === "production" ? durability + 15 : durability;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/xp.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/xp.ts tests/xp.test.ts
git commit -m "feat(xp): add level curve and per-review XP amounts"
```

---

### Task 2: Taipei time helpers (`src/lib/time.ts`)

**Files:**
- Modify: `src/lib/time.ts` (append; keep existing `formatClock`)
- Test: `tests/time.test.ts` (extend; keep existing cases)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `taipeiDate(d: Date): string` — `"YYYY-MM-DD"` in UTC+8
  - `taipeiYesterday(d: Date): string` — the UTC+8 date one day before `d`
  - `taipeiWeekKey(d: Date): string` — an opaque, chronologically-ordered 7-day bucket key

- [ ] **Step 1: Write the failing test (append to `tests/time.test.ts`)**

```typescript
// tests/time.test.ts — add these imports + describe blocks
import { taipeiDate, taipeiYesterday, taipeiWeekKey } from "@/lib/time";

describe("taipeiDate", () => {
  it("shifts UTC to UTC+8 before taking the calendar date", () => {
    // 2026-07-04T20:00Z is 2026-07-05 04:00 in Taipei
    expect(taipeiDate(new Date("2026-07-04T20:00:00Z"))).toBe("2026-07-05");
    // 2026-07-04T15:59Z is 2026-07-04 23:59 in Taipei (still the 4th)
    expect(taipeiDate(new Date("2026-07-04T15:59:00Z"))).toBe("2026-07-04");
  });
});

describe("taipeiYesterday", () => {
  it("is the Taipei calendar date 24h earlier", () => {
    expect(taipeiYesterday(new Date("2026-07-05T04:00:00+08:00"))).toBe("2026-07-04");
  });
});

describe("taipeiWeekKey", () => {
  it("is stable within a 7-day bucket and ordered across buckets", () => {
    const a = taipeiWeekKey(new Date("2026-07-04T12:00:00Z"));
    const b = taipeiWeekKey(new Date("2026-07-06T12:00:00Z"));
    const later = taipeiWeekKey(new Date("2026-07-20T12:00:00Z"));
    expect(a).toBe(b); // same week bucket -> equal key
    expect(Number(later)).toBeGreaterThan(Number(a)); // a later week -> greater key
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/time.test.ts`
Expected: FAIL — `taipeiDate is not a function` / import error.

- [ ] **Step 3: Write minimal implementation (append to `src/lib/time.ts`)**

```typescript
// src/lib/time.ts — append below formatClock

// Asia/Taipei is a fixed UTC+8 with no daylight saving, so we can bucket by a
// constant offset without a timezone library.
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function taipeiDate(d: Date): string {
  return new Date(d.getTime() + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);
}

export function taipeiYesterday(d: Date): string {
  return taipeiDate(new Date(d.getTime() - DAY_MS));
}

// Opaque per-week key: which 7-day block the Taipei day falls in. Used only to
// detect week rollover for the streak-freeze refill, so exact ISO-week
// numbering does not matter — only stability within a week and ordering.
export function taipeiWeekKey(d: Date): string {
  const days = Math.floor((d.getTime() + TAIPEI_OFFSET_MS) / DAY_MS);
  return String(Math.floor(days / 7));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/time.test.ts`
Expected: PASS (existing `formatClock` cases still pass too).

- [ ] **Step 5: Commit**

```bash
git add src/lib/time.ts tests/time.test.ts
git commit -m "feat(time): add Asia/Taipei date and week-bucket helpers"
```

---

### Task 3: Stats reducer — streak/goal/freeze (`src/lib/streak.ts`)

**Files:**
- Create: `src/lib/streak.ts`
- Test: `tests/streak.test.ts`

**Interfaces:**
- Consumes: `DAILY_GOAL_XP`, `levelFromXp` from `@/lib/xp` (Task 1).
- Produces:
  - `interface Stats { totalXp; currentStreak; longestStreak; lastActiveDate; lastGoalDate; todayXp; freezeCredits; freezeWeek }` (all `number` except the three date/week strings)
  - `const INITIAL_STATS: Stats`
  - `const FREEZE_PER_WEEK: number`
  - `interface ApplyXpResult { stats: Stats; leveledUp: boolean; goalReached: boolean }`
  - `applyXp(prev: Stats, amount: number, today: string, yesterday: string, weekKey: string): ApplyXpResult`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/streak.test.ts
import { describe, it, expect } from "vitest";
import { applyXp, INITIAL_STATS, type Stats } from "@/lib/streak";

// Fixed date strings; applyXp is pure and takes them as inputs.
const D1 = "2026-07-01";
const D2 = "2026-07-02";
const D4 = "2026-07-04"; // a gap: D2 -> D4 skips D3
const W = "0";

function base(overrides: Partial<Stats> = {}): Stats {
  return { ...INITIAL_STATS, ...overrides };
}

describe("applyXp", () => {
  it("accrues total and today XP", () => {
    const { stats } = applyXp(base(), 10, D1, "2026-06-30", W);
    expect(stats.totalXp).toBe(10);
    expect(stats.todayXp).toBe(10);
  });

  it("starts a streak when the daily goal is first reached", () => {
    const { stats, goalReached } = applyXp(base(), 30, D1, "2026-06-30", W);
    expect(goalReached).toBe(true);
    expect(stats.currentStreak).toBe(1);
    expect(stats.longestStreak).toBe(1);
    expect(stats.lastGoalDate).toBe(D1);
  });

  it("does not double-count the goal on the same day", () => {
    const day1 = applyXp(base(), 30, D1, "2026-06-30", W).stats;
    const { stats, goalReached } = applyXp(day1, 30, D1, "2026-06-30", W);
    expect(goalReached).toBe(false);
    expect(stats.currentStreak).toBe(1);
  });

  it("extends the streak on a consecutive day and resets todayXp", () => {
    const day1 = applyXp(base(), 30, D1, "2026-06-30", W).stats;
    const { stats } = applyXp(day1, 30, D2, D1, W);
    expect(stats.currentStreak).toBe(2);
    expect(stats.todayXp).toBe(30); // reset from the day-1 carryover, then +30
  });

  it("bridges a single missed day using a freeze credit", () => {
    // Day 1 goal met, 1 freeze available. Skip D3; act on D4.
    const day1 = applyXp(base({ freezeCredits: 1, freezeWeek: W }), 30, D1, "2026-06-30", W).stats;
    // roll to D2 without meeting goal is not required; jump straight to D4.
    const { stats } = applyXp(day1, 30, D4, "2026-07-03", W);
    expect(stats.freezeCredits).toBe(0); // consumed
    expect(stats.currentStreak).toBe(2); // preserved + extended, not reset
  });

  it("resets the streak when a day is missed and no freeze is left", () => {
    const day1 = applyXp(base({ freezeCredits: 0, freezeWeek: W }), 30, D1, "2026-06-30", W).stats;
    const { stats } = applyXp(day1, 30, D4, "2026-07-03", W);
    expect(stats.currentStreak).toBe(1); // reset to 0 on rollover, then +1 for today's goal
  });

  it("refills one freeze credit when the week bucket changes", () => {
    const s = base({ freezeCredits: 0, freezeWeek: "0" });
    const { stats } = applyXp(s, 5, D1, "2026-06-30", "1");
    expect(stats.freezeCredits).toBe(1);
    expect(stats.freezeWeek).toBe("1");
  });

  it("reports leveledUp when crossing a level threshold", () => {
    const s = base({ totalXp: 95 });
    const { leveledUp } = applyXp(s, 10, D1, "2026-06-30", W); // 95 -> 105 crosses 100
    expect(leveledUp).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/streak.test.ts`
Expected: FAIL — `Cannot find module '@/lib/streak'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/streak.ts
import { DAILY_GOAL_XP, levelFromXp } from "./xp";

export const FREEZE_PER_WEEK = 1;

export interface Stats {
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // "YYYY-MM-DD" (Taipei), last day any XP was earned
  lastGoalDate: string; // "YYYY-MM-DD" (Taipei), last day the goal was met
  todayXp: number; // XP earned on lastActiveDate
  freezeCredits: number; // buffer to bridge one missed day
  freezeWeek: string; // week bucket the freeze was last refilled in
}

export const INITIAL_STATS: Stats = {
  totalXp: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: "",
  lastGoalDate: "",
  todayXp: 0,
  freezeCredits: 0,
  freezeWeek: "",
};

export interface ApplyXpResult {
  stats: Stats;
  leveledUp: boolean;
  goalReached: boolean;
}

// Pure reducer: given previous stats and an XP amount earned "today" (a Taipei
// date string), return the next stats plus whether we leveled up / hit the goal.
// Dates are injected so this stays fully deterministic and unit-testable.
export function applyXp(
  prev: Stats,
  amount: number,
  today: string,
  yesterday: string,
  weekKey: string
): ApplyXpResult {
  const s: Stats = { ...prev };
  const prevLevel = levelFromXp(s.totalXp).level;

  // Weekly freeze refill.
  if (s.freezeWeek !== weekKey) {
    s.freezeCredits = FREEZE_PER_WEEK;
    s.freezeWeek = weekKey;
  }

  // Day rollover: reset today's XP and decide whether the streak survived a gap.
  let bridged = false;
  if (s.lastActiveDate !== today) {
    s.todayXp = 0;
    const missedFullDay =
      s.currentStreak > 0 && s.lastGoalDate !== "" && s.lastGoalDate < yesterday;
    if (missedFullDay) {
      if (s.freezeCredits > 0) {
        s.freezeCredits -= 1;
        bridged = true; // freeze keeps the streak alive across the gap
      } else {
        s.currentStreak = 0;
      }
    }
    s.lastActiveDate = today;
  }

  // Accrue XP.
  s.totalXp += amount;
  s.todayXp += amount;

  // Daily goal -> advance the streak (once per day).
  let goalReached = false;
  if (s.todayXp >= DAILY_GOAL_XP && s.lastGoalDate !== today) {
    if (s.lastGoalDate === yesterday || bridged) s.currentStreak += 1;
    else s.currentStreak = 1;
    s.lastGoalDate = today;
    s.longestStreak = Math.max(s.longestStreak, s.currentStreak);
    goalReached = true;
  }

  const leveledUp = levelFromXp(s.totalXp).level > prevLevel;
  return { stats: s, leveledUp, goalReached };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/streak.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/streak.ts tests/streak.test.ts
git commit -m "feat(streak): add pure XP/streak/freeze reducer"
```

---

### Task 4: `user_stats` schema + store adapter

**Files:**
- Modify: `src/db/schema.ts` (append a table)
- Create: `src/lib/stats-store.ts`

**Interfaces:**
- Consumes: `Stats`, `INITIAL_STATS` from `@/lib/streak` (Task 3); `getDb` from `@/db/client`.
- Produces:
  - Drizzle table `userStats` with columns matching `Stats` plus `id`.
  - `getOrCreateStats(db): Promise<Stats>` — returns the singleton row, creating it if absent.
  - `saveStats(db, stats: Stats): Promise<void>` — upserts the singleton row.

This task has no unit test (it is a thin DB adapter, mirroring how the codebase leaves `src/db/*` and route wiring to build + manual verification). Correctness is gated by `pnpm typecheck` and `pnpm build`.

- [ ] **Step 1: Add the table to `src/db/schema.ts`**

Append after the `cardProgress` table:

```typescript
// Single-row, global gamification state (XP, level, streak). Cloud-authoritative:
// db:sync never overwrites it. `id` is a fixed sentinel so there is exactly one row.
export const userStats = sqliteTable("user_stats", {
  id: text("id").primaryKey().default("singleton"),
  totalXp: integer("total_xp").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActiveDate: text("last_active_date").notNull().default(""),
  lastGoalDate: text("last_goal_date").notNull().default(""),
  todayXp: integer("today_xp").notNull().default(0),
  freezeCredits: integer("freeze_credits").notNull().default(0),
  freezeWeek: text("freeze_week").notNull().default(""),
});
```

- [ ] **Step 2: Create the store adapter `src/lib/stats-store.ts`**

```typescript
// src/lib/stats-store.ts
import { eq } from "drizzle-orm";
import type { getDb } from "@/db/client";
import { userStats } from "@/db/schema";
import { INITIAL_STATS, type Stats } from "@/lib/streak";

type DB = ReturnType<typeof getDb>;
const SINGLETON = "singleton";

// Read the one stats row, creating a default row the first time.
export async function getOrCreateStats(db: DB): Promise<Stats> {
  const row = (
    await db.select().from(userStats).where(eq(userStats.id, SINGLETON)).limit(1)
  )[0];
  if (row) {
    return {
      totalXp: row.totalXp,
      currentStreak: row.currentStreak,
      longestStreak: row.longestStreak,
      lastActiveDate: row.lastActiveDate,
      lastGoalDate: row.lastGoalDate,
      todayXp: row.todayXp,
      freezeCredits: row.freezeCredits,
      freezeWeek: row.freezeWeek,
    };
  }
  await db.insert(userStats).values({ id: SINGLETON }).onConflictDoNothing();
  return { ...INITIAL_STATS };
}

export async function saveStats(db: DB, s: Stats): Promise<void> {
  await db
    .insert(userStats)
    .values({ id: SINGLETON, ...s })
    .onConflictDoUpdate({ target: userStats.id, set: { ...s } });
}
```

- [ ] **Step 3: Create the local table**

Run: `pnpm db:push`
Expected: drizzle-kit applies the new `user_stats` table to `local.db` with no errors. (This talks to `file:local.db` because no Turso env is loaded in the shell.)

- [ ] **Step 4: Verify the project still compiles**

Run: `pnpm typecheck && pnpm build`
Expected: PASS (no type errors; build completes).

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/lib/stats-store.ts
git commit -m "feat(db): add cloud-authoritative user_stats table and store"
```

---

### Task 5: Award XP in the flashcard review route

**Files:**
- Modify: `src/app/api/flashcards/review/route.ts`

**Interfaces:**
- Consumes: `xpForReview`, `levelFromXp` (`@/lib/xp`); `applyXp` (`@/lib/streak`); `getOrCreateStats`, `saveStats` (`@/lib/stats-store`); `taipeiDate`, `taipeiYesterday`, `taipeiWeekKey` (`@/lib/time`).
- Produces: JSON response extended with an `xp` object:
  `{ ok, box, mastered, xp: { awarded, totalXp, level, xpIntoLevel, xpForNextLevel, currentStreak, leveledUp, goalReached } }`.

Logic (thin wiring over already-tested pure functions; gated by build + Task 7 manual check):

- [ ] **Step 1: Replace the route body**

Replace the full contents of `src/app/api/flashcards/review/route.ts` with:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { cardProgress, wrongWords } from "@/db/schema";
import { reviewCard, isMastered, dueDateFrom } from "@/lib/leitner";
import { xpForReview, levelFromXp } from "@/lib/xp";
import { applyXp } from "@/lib/streak";
import { getOrCreateStats, saveStats } from "@/lib/stats-store";
import { taipeiDate, taipeiYesterday, taipeiWeekKey } from "@/lib/time";

const schema = z.object({
  word: z.string().min(1),
  result: z.enum(["got", "again"]),
  mode: z.enum(["recognition", "production"]).default("recognition"),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const db = getDb();
  const existing = (
    await db
      .select({ box: cardProgress.box, lastReviewedAt: cardProgress.lastReviewedAt })
      .from(cardProgress)
      .where(eq(cardProgress.word, parsed.word))
      .limit(1)
  )[0];

  const { box, intervalDays } = reviewCard(existing?.box ?? 1, parsed.result);
  const now = new Date();
  const dueAt = dueDateFrom(now, intervalDays);

  await db
    .insert(cardProgress)
    .values({ word: parsed.word, box, dueAt, lastReviewedAt: now })
    .onConflictDoUpdate({
      target: cardProgress.word,
      set: { box, dueAt, lastReviewedAt: now },
    });

  let mastered = false;
  if (isMastered(box)) {
    mastered = true;
    // Mastering a word clears its "wrong" mark.
    await db.delete(wrongWords).where(eq(wrongWords.word, parsed.word));
  }

  // Anti-farming: at most one XP award per word per day (Taipei). A word already
  // reviewed today earns 0, so re-drilling the same word can't inflate XP.
  const alreadyToday =
    existing?.lastReviewedAt != null &&
    taipeiDate(existing.lastReviewedAt) === taipeiDate(now);
  const amount = alreadyToday
    ? 0
    : xpForReview({ mode: parsed.mode, result: parsed.result, box });

  const before = await getOrCreateStats(db);
  const { stats, leveledUp, goalReached } = applyXp(
    before,
    amount,
    taipeiDate(now),
    taipeiYesterday(now),
    taipeiWeekKey(now)
  );
  await saveStats(db, stats);
  const info = levelFromXp(stats.totalXp);

  return NextResponse.json({
    ok: true,
    box,
    mastered,
    xp: {
      awarded: amount,
      totalXp: stats.totalXp,
      level: info.level,
      xpIntoLevel: info.xpIntoLevel,
      xpForNextLevel: info.xpForNextLevel,
      currentStreak: stats.currentStreak,
      leveledUp,
      goalReached,
    },
  });
}
```

- [ ] **Step 2: Verify compile + existing tests**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: PASS (no type errors; all prior + new lib tests green; build ok).

- [ ] **Step 3: Manual smoke test against local DB**

Run:
```bash
LOCAL_MODE=1 pnpm dev
# in another shell:
curl -s -XPOST localhost:3000/api/flashcards/review \
  -H 'content-type: application/json' \
  -d '{"word":"contour","result":"got","mode":"recognition"}'
```
Expected: JSON includes `"xp":{"awarded":6,...,"level":1,...}` on first call; a second identical call the same day returns `"awarded":0` (per-day cap). Stop the dev server afterward.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/flashcards/review/route.ts
git commit -m "feat(flashcards): award quality-bound XP on review, once per word per day"
```

---

### Task 6: Status bar (level + XP + streak)

**Files:**
- Create: `src/components/StatusBar.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `getDb`; `getOrCreateStats` (`@/lib/stats-store`); `levelFromXp` (`@/lib/xp`).
- Produces: `async function StatusBar(): Promise<JSX.Element>` (default-styled server component).

- [ ] **Step 1: Create `src/components/StatusBar.tsx`**

```tsx
// src/components/StatusBar.tsx
import { getDb } from "@/db/client";
import { getOrCreateStats } from "@/lib/stats-store";
import { levelFromXp, DAILY_GOAL_XP } from "@/lib/xp";

// Server component: reads the single stats row and renders the persistent
// level / XP-progress / streak strip. Re-rendered on router.refresh() after a
// review writes XP (see StudyClient).
export async function StatusBar() {
  const db = getDb();
  const stats = await getOrCreateStats(db);
  const { level, xpIntoLevel, xpForNextLevel } = levelFromXp(stats.totalXp);
  const pct = xpForNextLevel
    ? Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100))
    : 0;
  const goalPct = Math.min(100, Math.round((stats.todayXp / DAILY_GOAL_XP) * 100));

  return (
    <div className="border-b border-border bg-surface/60">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-1.5 text-xs sm:px-6">
        <span
          className="grid h-6 min-w-6 place-items-center rounded-md bg-accent px-1.5 text-[11px] font-bold text-accent-fg"
          title={`Level ${level}`}
        >
          Lv{level}
        </span>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={xpForNextLevel}
            aria-valuenow={xpIntoLevel}
            aria-label="XP to next level"
          >
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="shrink-0 tabular-nums text-muted">
            {xpIntoLevel}/{xpForNextLevel} XP
          </span>
        </div>

        <span
          className="shrink-0 tabular-nums text-muted"
          title={`Today ${stats.todayXp}/${DAILY_GOAL_XP} XP · goal ${goalPct}%`}
        >
          🔥 {stats.currentStreak}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount it in `src/app/layout.tsx`**

Add the import near the other component import:

```tsx
import { StatusBar } from "@/components/StatusBar";
```

Then render it directly under `<TopNav links={links} />` inside `<body>`:

```tsx
        <TopNav links={links} />
        <StatusBar />
        {children}
```

- [ ] **Step 3: Verify compile + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS. (An async server component rendered inside the sync layout is valid in Next 16.)

- [ ] **Step 4: Manual check**

Run: `LOCAL_MODE=1 pnpm dev`, open http://localhost:3000 — the strip shows `Lv1`, an XP bar, and `🔥 <n>`. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add src/components/StatusBar.tsx src/app/layout.tsx
git commit -m "feat(ui): add persistent level/XP/streak status bar"
```

---

### Task 7: In-the-moment XP feedback in the flashcard client

**Files:**
- Modify: `src/app/flashcards/StudyClient.tsx`

**Interfaces:**
- Consumes: the `xp` object from `POST /api/flashcards/review` (Task 5); `useRouter` from `next/navigation`.
- Produces: no exported API change; adds a transient toast + level-up banner and refreshes the server `StatusBar`.

- [ ] **Step 1: Import `useRouter` and add feedback state**

At the top of `StudyClient.tsx`, extend the React import and add the router:

```tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
```

Inside `StudyClient`, after the existing `const [mode, setMode] = ...` line, add:

```tsx
  const router = useRouter();
  const [toast, setToast] = useState<{ amount: number; leveledUp: boolean } | null>(null);
```

- [ ] **Step 2: Send `mode` and consume the `xp` payload in `grade()`**

In the existing `grade()` function, change the fetch body to include `mode`, and after computing `mastered`, read the XP payload, show the toast, and refresh the status bar. Replace the `try { ... } catch { ... }` block's body with:

```tsx
    try {
      const res = await fetch("/api/flashcards/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: current.word, result, mode }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        mastered?: boolean;
        xp?: { awarded: number; leveledUp: boolean };
      };
      mastered = !!data.mastered;
      if (data.xp && data.xp.awarded > 0) {
        setToast({ amount: data.xp.awarded, leveledUp: data.xp.leveledUp });
        // Server StatusBar reads the DB; re-fetch it so level/XP/streak update.
        router.refresh();
        setTimeout(() => setToast(null), 1400);
      }
    } catch {
      // Network failure: still advance; progress just won't persist this time.
    }
```

- [ ] **Step 3: Render the toast**

Immediately inside the top-level returned `<div className="space-y-4">` (as its first child), add a relatively-positioned overlay:

```tsx
      {toast && (
        <div
          className="pointer-events-none fixed left-1/2 top-20 z-30 -translate-x-1/2"
          aria-live="polite"
        >
          <div className="animate-[fadeUp_1.4s_ease-out] rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-fg shadow-lg">
            +{toast.amount} XP{toast.leveledUp ? " · Level up! 🎉" : ""}
          </div>
        </div>
      )}
```

- [ ] **Step 4: Add the `fadeUp` keyframe to `src/app/globals.css`**

Append:

```css
@keyframes fadeUp {
  0% { opacity: 0; transform: translateY(6px); }
  15% { opacity: 1; transform: translateY(0); }
  80% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-6px); }
}
```

- [ ] **Step 5: Verify + manual check**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS.
Then `LOCAL_MODE=1 pnpm dev`, open `/flashcards`, grade a card "Got it" — a "+N XP" pill fades in/out and the top bar's XP advances. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add src/app/flashcards/StudyClient.tsx src/app/globals.css
git commit -m "feat(flashcards): show +XP toast and refresh status bar on review"
```

---

### Task 8: Narrow `db:sync` to content tables (fixes progress-wipe bug)

**Files:**
- Modify: `scripts/db-sync.sh`
- Modify: `scripts/db-sync.mjs`
- Modify: `README.md` (the "Refreshing cloud content" section)

**Interfaces:** none (operational scripts).

- [ ] **Step 1: Restrict the drop + dump to content tables in `scripts/db-sync.sh`**

Replace the block that builds the reload script (from `echo "Syncing ..."` through the `} | node scripts/db-sync.mjs` line) with:

```bash
echo "Syncing $LOCAL_DB -> Turso (content tables only)..."

# CONTENT tables are author-side and safe to overwrite from local.db.
# PROGRESS tables (card_progress, wrong_words, user_stats) are cloud-authoritative
# — they accumulate from studying on the deployed site — so we NEVER drop or
# reload them here. (This is the fix for the old clean-reload that silently wiped
# cloud flashcard/XP progress on every daily sync.)
#
# Drop child-first so foreign keys don't block the drop; recreate parent-first.
{
  echo "PRAGMA foreign_keys=OFF;"
  echo "DROP TABLE IF EXISTS \"attempts\";"
  echo "DROP TABLE IF EXISTS \"questions\";"
  sqlite3 "$LOCAL_DB" ".dump questions attempts"
} | node scripts/db-sync.mjs

echo "Done."
```

- [ ] **Step 2: Update the reporting table list in `scripts/db-sync.mjs`**

Change the `const tables = [...]` line to also report `user_stats` and make clear which are preserved:

```javascript
  // questions/attempts were just reloaded; the rest are cloud-authoritative and
  // were intentionally left untouched — reported here so the operator can see them.
  const tables = ["questions", "attempts", "wrong_words", "card_progress", "user_stats"];
```

- [ ] **Step 3: Manual verification against local (dry sanity, no cloud needed)**

Run: `sqlite3 local.db ".dump questions attempts" | head -5`
Expected: prints `CREATE TABLE ... questions ...` and INSERT lines — confirming the two-table dump works. (Full cloud sync is exercised in Task 9.)

- [ ] **Step 4: Update `README.md`**

In the "Refreshing cloud content (review-only)" section, replace the paragraph beginning "`scripts/db-sync.sh` does a **clean reload**" with:

```markdown
`scripts/db-sync.sh` reloads only the **content** tables (`questions`,
`attempts`) — it drops and recreates just those from `local.db`. The
**progress** tables (`card_progress`, `wrong_words`, `user_stats`) are
**cloud-authoritative**: they accumulate as you study on the deployed site, so
the sync never touches them. (Content flows local→cloud; progress lives only in
the cloud.)
```

- [ ] **Step 5: Commit**

```bash
git add scripts/db-sync.sh scripts/db-sync.mjs README.md
git commit -m "fix(sync): reload only content tables so cloud progress is never wiped"
```

---

### Task 9: Deploy — create `user_stats` on Turso, promote, verify

**Files:** none (operational).

- [ ] **Step 1: Create the `user_stats` table on Turso**

Run:
```bash
set -a; . ./.env.sync; set +a
pnpm db:push
```
Expected: drizzle-kit reports creating `user_stats` on the Turso database (other tables already exist / unchanged). Confirm no destructive drops are proposed for existing progress tables; if drizzle-kit prompts, accept only the additive `user_stats` creation.

- [ ] **Step 2: Run a real content sync and confirm progress is preserved**

Run: `pnpm db:sync`
Expected: prints `Turso row counts: questions <n>, attempts <n>, wrong_words <n>, card_progress <n>, user_stats <n>` and `Done.` — with `card_progress` NOT reset to the local count (it keeps its cloud value).

- [ ] **Step 3: Promote dev → main (existing workflow)**

Run:
```bash
git push origin dev
# wait for CI `verify` to go green on dev, then:
git push origin dev:main
```
Expected: CI green on dev; `main` fast-forwards to the same commit; Vercel deploys production from `main`.

- [ ] **Step 4: Verify on the deployed site**

Sign in, open `/flashcards`, grade a card. Expected: the top status bar shows the level/XP bar and streak, "+N XP" toast appears, and refreshing the page keeps the new totals (persisted in Turso). Grade enough cards to cross 30 XP and confirm `🔥` increments to 1.

- [ ] **Step 5: Update the daily-auto-author memory note if needed**

If the progress/content split changes how the daily job should be described, update `~/.claude/.../memory/daily-auto-author-flow.md`. Otherwise skip.

---

## Self-Review

**Spec coverage:**
- Cloud persistence / never-wiped progress → Tasks 4, 8, 9. ✓
- Single global XP (no per-user) → Task 4 (`singleton` row). ✓
- Quality-bound XP (recognition/production/again, box scaling) → Tasks 1, 5. ✓
- Per-word per-day cap → Task 5 (via `lastReviewedAt`). ✓
- Symbolic levels (curve, no gating) → Task 1, 6. ✓
- Daily goal + streak + one weekly freeze → Task 3. ✓
- Status bar → Task 6. ✓
- In-the-moment feedback → Task 7. ✓
- Sync contract + bug fix → Task 8. ✓
- Deferred (question-review XP, dashboard, badges) → not implemented, documented in spec. ✓

**Placeholder scan:** No TBD/TODO; every code step contains full content. ✓

**Type consistency:** `Stats` fields identical across Tasks 3/4/5/6; `xp` response object produced in Task 5 matches the shape consumed in Task 7 (`awarded`, `leveledUp`); `levelFromXp`/`LevelInfo` names consistent across Tasks 1/5/6. ✓
