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

// XP is quality-bound. Nothing for "again". A flat base plus a small box bonus
// (`5 + box`) rewards durable memory without letting easy re-reviews of mastered
// words dwarf real learning. Production (writing a sentence) adds a premium, and
// the first time a word is ever answered correctly grants a one-time acquisition
// bonus so conquering a NEW word beats re-reviewing an old mastered one.
export function xpForReview(input: {
  mode: ReviewMode;
  result: "got" | "again";
  box: number;
  firstAcquisition?: boolean;
}): number {
  if (input.result === "again") return 0;
  let xp = 5 + input.box;
  if (input.mode === "production") xp += 12;
  if (input.firstAcquisition) xp += 8;
  return xp;
}

// XP for completing a whole question: 3 per correct blank, plus a full-marks
// bonus. `correct` is clamped into [0, total] so a bad/forged score can't
// inflate the award (the server passes the question's real blank count as total).
export function xpForQuestion(input: { correct: number; total: number }): number {
  const correct = Math.max(0, Math.min(input.correct, input.total));
  const base = correct * 3;
  const bonus = input.total > 0 && correct === input.total ? 10 : 0;
  return base + bonus;
}
