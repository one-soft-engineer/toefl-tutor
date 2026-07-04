import { describe, it, expect } from "vitest";
import {
  cumulativeXpForLevel,
  levelFromXp,
  xpForReview,
  xpForQuestion,
  DAILY_GOAL_XP,
} from "@/lib/xp";

describe("cumulativeXpForLevel", () => {
  it("is triangular: L1=0, L2=100, L3=300, L4=600", () => {
    expect(cumulativeXpForLevel(1)).toBe(0);
    expect(cumulativeXpForLevel(2)).toBe(100);
    expect(cumulativeXpForLevel(3)).toBe(300);
    expect(cumulativeXpForLevel(4)).toBe(600);
  });
});

describe("levelFromXp", () => {
  it("stays at level 1 below 100 xp", () => {
    expect(levelFromXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNextLevel: 100 });
    expect(levelFromXp(99)).toEqual({ level: 1, xpIntoLevel: 99, xpForNextLevel: 100 });
  });
  it("crosses to level 2 at exactly 100 xp", () => {
    expect(levelFromXp(100)).toEqual({ level: 2, xpIntoLevel: 0, xpForNextLevel: 200 });
  });
  it("reports progress within a level", () => {
    expect(levelFromXp(450)).toEqual({ level: 3, xpIntoLevel: 150, xpForNextLevel: 300 });
  });
});

describe("xpForReview", () => {
  it("gives nothing for 'again' regardless of mode/box", () => {
    expect(xpForReview({ mode: "recognition", result: "again", box: 5 })).toBe(0);
    expect(xpForReview({ mode: "production", result: "again", box: 3 })).toBe(0);
  });
  it("recognition is 5 + box (flatter, so easy re-reviews aren't over-rewarded)", () => {
    expect(xpForReview({ mode: "recognition", result: "got", box: 2 })).toBe(7);
    expect(xpForReview({ mode: "recognition", result: "got", box: 5 })).toBe(10);
  });
  it("production adds a +12 premium over recognition", () => {
    expect(xpForReview({ mode: "production", result: "got", box: 2 })).toBe(19);
    expect(xpForReview({ mode: "production", result: "got", box: 5 })).toBe(22);
  });
  it("grants a +8 first-acquisition bonus, making a new word beat a mastered re-review", () => {
    // New word conquered (recognition, first time): 7 + 8 = 15
    expect(
      xpForReview({ mode: "recognition", result: "got", box: 2, firstAcquisition: true })
    ).toBe(15);
    // Mastered old word re-reviewed: box 5 = 10. New (15) > old (10).
    expect(xpForReview({ mode: "recognition", result: "got", box: 5 })).toBe(10);
    // Production first acquisition: 19 + 8 = 27
    expect(
      xpForReview({ mode: "production", result: "got", box: 2, firstAcquisition: true })
    ).toBe(27);
    // No bonus on "again" even if flagged first acquisition.
    expect(
      xpForReview({ mode: "recognition", result: "again", box: 1, firstAcquisition: true })
    ).toBe(0);
  });
  it("exposes the daily goal constant", () => {
    expect(DAILY_GOAL_XP).toBe(30);
  });
});

describe("xpForQuestion", () => {
  it("awards 3 per correct blank", () => {
    expect(xpForQuestion({ correct: 3, total: 10 })).toBe(9);
    expect(xpForQuestion({ correct: 0, total: 10 })).toBe(0);
  });
  it("adds a +10 bonus for full marks", () => {
    expect(xpForQuestion({ correct: 10, total: 10 })).toBe(40);
    expect(xpForQuestion({ correct: 5, total: 5 })).toBe(25);
  });
  it("clamps correct into [0, total] so a bad score can't inflate XP", () => {
    expect(xpForQuestion({ correct: 99, total: 10 })).toBe(40); // treated as full marks
    expect(xpForQuestion({ correct: -3, total: 10 })).toBe(0);
  });
  it("gives nothing for a zero-blank question", () => {
    expect(xpForQuestion({ correct: 0, total: 0 })).toBe(0);
  });
});
