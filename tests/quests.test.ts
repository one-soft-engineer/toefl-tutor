import { describe, it, expect } from "vitest";
import { INITIAL_STATS, recordActivity, type Stats } from "@/lib/streak";
import { questStatuses, QUESTS } from "@/lib/quests";

const D1 = "2026-07-01";
const D2 = "2026-07-02";
const Y0 = "2026-06-30";
const DBY0 = "2026-06-29";
const W = "0";

function base(o: Partial<Stats> = {}): Stats {
  return { ...INITIAL_STATS, ...o };
}
// recordActivity(prev, {baseXp,newWord,question}, today, yesterday, dayBeforeYesterday, weekKey)
const rec = (s: Stats, input: { baseXp: number; newWord?: boolean; question?: boolean }) =>
  recordActivity(s, input, D1, Y0, DBY0, W);

describe("QUESTS", () => {
  it("defines exactly the three daily quests", () => {
    expect(QUESTS.map((q) => q.id)).toEqual(["daily-drill", "new-acquisition", "trial"]);
  });
});

describe("recordActivity — quests + XP + streak", () => {
  it("claims a quest and adds its bonus XP", () => {
    // Completing a question (baseXp 9) claims the Trial quest (+10) -> 19 total.
    const { stats, claimedQuests } = rec(base(), { baseXp: 9, question: true });
    expect(stats.questionsToday).toBe(1);
    expect(claimedQuests.map((q) => q.id)).toContain("trial");
    expect(stats.totalXp).toBe(19); // 9 base + 10 trial bonus
  });

  it("counts quest bonus XP toward the daily goal and streak (bonus BEFORE goal eval)", () => {
    // baseXp 20 + question: Trial (+10) -> 30 -> Daily Drill also completes (+10) -> 40.
    const { stats, claimedQuests, goalReached } = rec(base(), { baseXp: 20, question: true });
    expect(claimedQuests.map((q) => q.id).sort()).toEqual(["daily-drill", "trial"]);
    expect(stats.totalXp).toBe(40);
    expect(goalReached).toBe(true);
    expect(stats.currentStreak).toBe(1); // goal met thanks to quest bonuses
  });

  it("claims each quest only once per day", () => {
    const day = rec(base(), { baseXp: 9, question: true }).stats; // trial claimed
    const again = recordActivity(day, { baseXp: 9, question: true }, D1, Y0, DBY0, W);
    expect(again.claimedQuests).toHaveLength(0); // already claimed today
    expect(again.stats.totalXp).toBe(19 + 9); // only base XP, no second bonus
  });

  it("resets quests and counters on a new Taipei day", () => {
    const day1 = rec(base(), { baseXp: 9, question: true }).stats;
    expect(day1.questClaimedMask).not.toBe(0);
    // Next day: same activity should be claimable again.
    const day2 = recordActivity(day1, { baseXp: 9, question: true }, D2, D1, Y0, W);
    expect(day2.stats.questionsToday).toBe(1); // reset then +1
    expect(day2.claimedQuests.map((q) => q.id)).toContain("trial");
  });

  it("tracks new-word acquisition for the New Acquisition quest", () => {
    const { stats, claimedQuests } = rec(base(), { baseXp: 15, newWord: true });
    expect(stats.newWordsToday).toBe(1);
    expect(claimedQuests.map((q) => q.id)).toContain("new-acquisition");
  });
});

describe("questStatuses", () => {
  it("reports current/target/done/claimed for each quest", () => {
    const s = base({ todayXp: 30, newWordsToday: 0, questionsToday: 1, questClaimedMask: 4 });
    const byId = Object.fromEntries(questStatuses(s).map((q) => [q.def.id, q]));
    expect(byId["daily-drill"]).toMatchObject({ current: 30, target: 30, done: true, claimed: false });
    expect(byId["new-acquisition"]).toMatchObject({ current: 0, done: false });
    expect(byId["trial"]).toMatchObject({ current: 1, done: true, claimed: true });
  });
});
