import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { questions, questionProgress } from "@/db/schema";
import { xpForQuestion } from "@/lib/xp";
import { recordActivity } from "@/lib/streak";
import { buildXpResult } from "@/lib/xp-response";
import { getOrCreateStats, saveStats } from "@/lib/stats-store";
import {
  taipeiDate,
  taipeiYesterday,
  taipeiDayBeforeYesterday,
  taipeiWeekKey,
} from "@/lib/time";

// Awards XP for completing a question on /review. Capped to one award per
// question per Taipei-day via question_progress (cloud-authoritative). The score
// is clamped against the question's real blank count so it can't be inflated.
const schema = z.object({
  questionId: z.string().min(1),
  score: z.number().int(),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const db = getDb();
  const question = (
    await db
      .select({ blanks: questions.blanks })
      .from(questions)
      .where(eq(questions.id, parsed.questionId))
      .limit(1)
  )[0];
  if (!question) {
    return NextResponse.json({ error: "unknown question" }, { status: 404 });
  }

  const total = question.blanks.length;
  const now = new Date();
  const today = taipeiDate(now);

  // Per-question-per-day cap: only the first completion each day earns XP.
  const progress = (
    await db
      .select({ lastXpDate: questionProgress.lastXpDate })
      .from(questionProgress)
      .where(eq(questionProgress.questionId, parsed.questionId))
      .limit(1)
  )[0];
  const alreadyToday = progress?.lastXpDate === today;

  const amount = alreadyToday
    ? 0
    : xpForQuestion({ correct: parsed.score, total });

  // Only burn the day's slot when we actually award XP, so a 0-score submit
  // (fat-finger or timed-out attempt) doesn't lock out a real try later today.
  if (amount > 0) {
    await db
      .insert(questionProgress)
      .values({ questionId: parsed.questionId, lastXpDate: today })
      .onConflictDoUpdate({
        target: questionProgress.questionId,
        set: { lastXpDate: today },
      });
  }

  const before = await getOrCreateStats(db);
  const { stats, leveledUp, goalReached, claimedQuests } = recordActivity(
    before,
    { baseXp: amount, question: amount > 0 },
    today,
    taipeiYesterday(now),
    taipeiDayBeforeYesterday(now),
    taipeiWeekKey(now)
  );
  await saveStats(db, stats);

  return NextResponse.json({
    ok: true,
    xp: buildXpResult(before, stats, { leveledUp, goalReached, claimedQuests }),
  });
}
