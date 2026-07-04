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

// Per-question daily XP cap for completing a question on /review. Cloud-
// authoritative (not in db:sync's content reload set), so redoing a question is
// capped to one XP award per Taipei-day. `lastXpDate` is a "YYYY-MM-DD" string.
export const questionProgress = sqliteTable("question_progress", {
  questionId: text("question_id").primaryKey(),
  lastXpDate: text("last_xp_date").notNull().default(""),
});

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
  // Daily quest tracking (reset on the Taipei day rollover in applyXp/recordActivity).
  newWordsToday: integer("new_words_today").notNull().default(0),
  questionsToday: integer("questions_today").notNull().default(0),
  questClaimedMask: integer("quest_claimed_mask").notNull().default(0),
});
