import { eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { questions, attempts, wrongWords } from "./schema";
import type { IngestDeps } from "@/lib/ingest";

export const drizzleIngestDeps: IngestDeps = {
  async upsertQuestion(q) {
    const db = getDb();
    // Dedupe by passage: reuse if it already exists.
    const existing = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.passage, q.passage))
      .limit(1);
    if (existing[0]) return existing[0].id;

    const inserted = await db
      .insert(questions)
      .values({
        passage: q.passage,
        blanks: q.blanks,
        topic: q.topic,
        source: q.source,
      })
      .returning({ id: questions.id });
    return inserted[0].id;
  },

  async insertAttempt(a) {
    const db = getDb();
    await db.insert(attempts).values({
      questionId: a.questionId,
      score: a.score,
      answers: a.answers,
    });
  },

  async upsertWrongWord(word, questionId) {
    const db = getDb();
    await db
      .insert(wrongWords)
      .values({ word, lastQuestionId: questionId })
      .onConflictDoUpdate({
        target: wrongWords.word,
        set: {
          wrongCount: sql`${wrongWords.wrongCount} + 1`,
          lastQuestionId: questionId,
          lastWrongAt: sql`now()`,
        },
      });
  },
};
