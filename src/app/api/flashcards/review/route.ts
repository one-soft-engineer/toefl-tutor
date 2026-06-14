import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { cardProgress, wrongWords } from "@/db/schema";
import { reviewCard, isMastered, dueDateFrom } from "@/lib/leitner";

const schema = z.object({
  word: z.string().min(1),
  result: z.enum(["got", "again"]),
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
      .select({ box: cardProgress.box })
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

  return NextResponse.json({ ok: true, box, mastered });
}
