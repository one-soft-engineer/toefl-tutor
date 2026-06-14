import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type { Blank, BlankAnswer } from "@/lib/types";

const uuid = () => crypto.randomUUID();

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey().$defaultFn(uuid),
  passage: text("passage").notNull(),
  blanks: text("blanks", { mode: "json" }).$type<Blank[]>().notNull(),
  topic: text("topic").notNull(),
  source: text("source").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const attempts = sqliteTable("attempts", {
  id: text("id").primaryKey().$defaultFn(uuid),
  questionId: text("question_id")
    .references(() => questions.id)
    .notNull(),
  answers: text("answers", { mode: "json" }).$type<BlankAnswer[]>().notNull(),
  score: integer("score").notNull(),
  takenAt: integer("taken_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const wrongWords = sqliteTable("wrong_words", {
  id: text("id").primaryKey().$defaultFn(uuid),
  word: text("word").notNull().unique(),
  wrongCount: integer("wrong_count").notNull().default(1),
  lastQuestionId: text("last_question_id").references(() => questions.id),
  lastWrongAt: integer("last_wrong_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Leitner spaced-repetition progress per word (for flashcards).
export const cardProgress = sqliteTable("card_progress", {
  word: text("word").primaryKey(),
  box: integer("box").notNull().default(1),
  dueAt: integer("due_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  lastReviewedAt: integer("last_reviewed_at", { mode: "timestamp" }),
});
