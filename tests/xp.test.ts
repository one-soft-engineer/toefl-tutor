import { describe, it, expect } from "vitest";
import {
  cumulativeXpForLevel,
  levelFromXp,
  xpForReview,
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
  it("scales recognition XP by the resulting box", () => {
    expect(xpForReview({ mode: "recognition", result: "got", box: 2 })).toBe(6);
    expect(xpForReview({ mode: "recognition", result: "got", box: 5 })).toBe(15);
  });
  it("rewards production highest (box·3 + 15)", () => {
    expect(xpForReview({ mode: "production", result: "got", box: 2 })).toBe(21);
    expect(xpForReview({ mode: "production", result: "got", box: 5 })).toBe(30);
  });
  it("exposes the daily goal constant", () => {
    expect(DAILY_GOAL_XP).toBe(30);
  });
});
