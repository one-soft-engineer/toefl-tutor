import { describe, it, expect } from "vitest";
import { applyXp, INITIAL_STATS, type Stats } from "@/lib/streak";

// Fixed date strings; applyXp is pure and takes them as inputs.
// Signature: applyXp(prev, amount, today, yesterday, dayBeforeYesterday, weekKey)
const D1 = "2026-07-01";
const D2 = "2026-07-02";
const D3 = "2026-07-03";
const D4 = "2026-07-04";
const W = "0";

function base(overrides: Partial<Stats> = {}): Stats {
  return { ...INITIAL_STATS, ...overrides };
}

describe("applyXp", () => {
  it("accrues total and today XP", () => {
    const { stats } = applyXp(base(), 10, D1, "2026-06-30", "2026-06-29", W);
    expect(stats.totalXp).toBe(10);
    expect(stats.todayXp).toBe(10);
  });

  it("starts a streak when the daily goal is first reached", () => {
    const { stats, goalReached } = applyXp(base(), 30, D1, "2026-06-30", "2026-06-29", W);
    expect(goalReached).toBe(true);
    expect(stats.currentStreak).toBe(1);
    expect(stats.longestStreak).toBe(1);
    expect(stats.lastGoalDate).toBe(D1);
  });

  it("does not double-count the goal on the same day", () => {
    const day1 = applyXp(base(), 30, D1, "2026-06-30", "2026-06-29", W).stats;
    const { stats, goalReached } = applyXp(day1, 30, D1, "2026-06-30", "2026-06-29", W);
    expect(goalReached).toBe(false);
    expect(stats.currentStreak).toBe(1);
  });

  it("extends the streak on a consecutive day and resets todayXp", () => {
    const day1 = applyXp(base(), 30, D1, "2026-06-30", "2026-06-29", W).stats;
    const { stats } = applyXp(day1, 30, D2, D1, "2026-06-30", W);
    expect(stats.currentStreak).toBe(2);
    expect(stats.todayXp).toBe(30); // reset from the day-1 carryover, then +30
  });

  it("bridges exactly one missed day using a freeze credit", () => {
    // Goal on D1, then act on D3 (D2 missed). yesterday=D2, dayBeforeYesterday=D1.
    const day1 = applyXp(base({ freezeCredits: 1, freezeWeek: W }), 30, D1, "2026-06-30", "2026-06-29", W).stats;
    const { stats } = applyXp(day1, 30, D3, D2, D1, W);
    expect(stats.freezeCredits).toBe(0); // consumed
    expect(stats.currentStreak).toBe(2); // preserved + extended, not reset
  });

  it("does NOT bridge a multi-day gap even with a freeze credit", () => {
    // Goal on D1, then act on D4 (D2 AND D3 missed). One freeze can't cover two days.
    const day1 = applyXp(base({ freezeCredits: 1, freezeWeek: W }), 30, D1, "2026-06-30", "2026-06-29", W).stats;
    const { stats } = applyXp(day1, 30, D4, D3, D2, W);
    expect(stats.currentStreak).toBe(1); // reset to 0 on rollover, then +1 for today's goal
    expect(stats.freezeCredits).toBe(1); // NOT consumed on a non-bridgeable gap
  });

  it("resets the streak when a single day is missed but no freeze is left", () => {
    // Goal on D1 with no freeze, act on D3 (D2 missed). yesterday=D2, dayBeforeYesterday=D1.
    const day1 = applyXp(base({ freezeCredits: 0, freezeWeek: W }), 30, D1, "2026-06-30", "2026-06-29", W).stats;
    const { stats } = applyXp(day1, 30, D3, D2, D1, W);
    expect(stats.currentStreak).toBe(1); // reset to 0 on rollover, then +1 for today's goal
  });

  it("refills one freeze credit when the week bucket changes", () => {
    const s = base({ freezeCredits: 0, freezeWeek: "0" });
    const { stats } = applyXp(s, 5, D1, "2026-06-30", "2026-06-29", "1");
    expect(stats.freezeCredits).toBe(1);
    expect(stats.freezeWeek).toBe("1");
  });

  it("reports leveledUp when crossing a level threshold", () => {
    const s = base({ totalXp: 95 });
    const { leveledUp } = applyXp(s, 10, D1, "2026-06-30", "2026-06-29", W); // 95 -> 105 crosses 100
    expect(leveledUp).toBe(true);
  });
});
