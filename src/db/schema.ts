import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import type { Blank, BlankAnswer } from "@/lib/types";

export const questions = pgTable("questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  passage: text("passage").notNull(),
  blanks: jsonb("blanks").$type<Blank[]>().notNull(),
  topic: text("topic").notNull(),
  source: text("source").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const attempts = pgTable("attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  questionId: uuid("question_id")
    .references(() => questions.id)
    .notNull(),
  answers: jsonb("answers").$type<BlankAnswer[]>().notNull(),
  score: integer("score").notNull(),
  takenAt: timestamp("taken_at").defaultNow().notNull(),
});

export const wrongWords = pgTable("wrong_words", {
  id: uuid("id").defaultRandom().primaryKey(),
  word: text("word").notNull().unique(),
  wrongCount: integer("wrong_count").notNull().default(1),
  lastQuestionId: uuid("last_question_id").references(() => questions.id),
  lastWrongAt: timestamp("last_wrong_at").defaultNow().notNull(),
});
