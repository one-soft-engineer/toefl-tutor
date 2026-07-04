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
      newWordsToday: row.newWordsToday,
      questionsToday: row.questionsToday,
      questClaimedMask: row.questClaimedMask,
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
