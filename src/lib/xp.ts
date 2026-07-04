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

// XP is quality-bound: nothing for "again"; higher Leitner boxes are worth more
// (durable memory), and production (writing a sentence) is worth the most.
export function xpForReview(input: {
  mode: ReviewMode;
  result: "got" | "again";
  box: number;
}): number {
  if (input.result === "again") return 0;
  const durability = input.box * 3;
  return input.mode === "production" ? durability + 15 : durability;
}
