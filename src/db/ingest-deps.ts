import { eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { questions, attempts, wrongWords, cardProgress } from "./schema";
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
          lastWrongAt: new Date(),
        },
      });

    // A quiz mistake re-trains the word regardless of prior flashcard mastery:
    // reset its Leitner progress to box 1, due immediately.
    const now = new Date();
    await db
      .insert(cardProgress)
      .values({ word, box: 1, dueAt: now })
      .onConflictDoUpdate({
        target: cardProgress.word,
        set: { box: 1, dueAt: now },
      });
  },
};
