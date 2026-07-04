import { describe, it, expect } from "vitest";
import { rankFromLevel, RANKS } from "@/lib/rank";

describe("RANKS ladder", () => {
  it("has 8 tiers with ascending, contiguous minLevels", () => {
    expect(RANKS).toHaveLength(8);
    expect(RANKS.map((r) => r.minLevel)).toEqual([1, 5, 10, 15, 20, 25, 30, 40]);
    expect(RANKS[0].title).toBe("Novice Reader");
    expect(RANKS[7].title).toBe("Archmage of Lexicon");
  });
});

describe("rankFromLevel", () => {
  it("maps a level to its tier with the next-rank threshold", () => {
    expect(rankFromLevel(1)).toMatchObject({ tier: 1, title: "Novice Reader", minLevel: 1, nextLevel: 5 });
    expect(rankFromLevel(4)).toMatchObject({ tier: 1, nextLevel: 5 });
    expect(rankFromLevel(5)).toMatchObject({ tier: 2, title: "Word Apprentice", minLevel: 5, nextLevel: 10 });
    expect(rankFromLevel(29)).toMatchObject({ tier: 6, title: "Loremaster", minLevel: 25, nextLevel: 30 });
    expect(rankFromLevel(30)).toMatchObject({ tier: 7, title: "Sage of Words", minLevel: 30, nextLevel: 40 });
  });

  it("keeps the top tier open-ended (nextLevel null) from level 40 up", () => {
    expect(rankFromLevel(40)).toMatchObject({ tier: 8, title: "Archmage of Lexicon", minLevel: 40, nextLevel: null });
    expect(rankFromLevel(100)).toMatchObject({ tier: 8, nextLevel: null });
  });

  it("clamps levels below 1 to the first tier", () => {
    expect(rankFromLevel(0)).toMatchObject({ tier: 1 });
  });

  it("exposes a colorKey for UI tinting", () => {
    expect(rankFromLevel(1).colorKey).toBe("slate");
    expect(rankFromLevel(40).colorKey).toBe("gold");
  });
});
