import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { cardProgress, wrongWords } from "@/db/schema";
import { reviewCard, isMastered, dueDateFrom } from "@/lib/leitner";
import { xpForReview, levelFromXp } from "@/lib/xp";
import { applyXp } from "@/lib/streak";
import { getOrCreateStats, saveStats } from "@/lib/stats-store";
import {
  taipeiDate,
  taipeiYesterday,
  taipeiDayBeforeYesterday,
  taipeiWeekKey,
} from "@/lib/time";

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
    taipeiDayBeforeYesterday(now),
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
