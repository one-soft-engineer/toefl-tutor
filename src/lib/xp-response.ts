import { levelFromXp } from "./xp";
import { rankFromLevel } from "./rank";
import type { Stats } from "./streak";
import type { QuestDef } from "./quests";

// Builds the `xp` object returned by the review/question endpoints from the
// before/after stats. `awarded` is the total XP delta (base + any quest bonuses),
// and `rankUp` compares the rank tier across the change so the client can flavor
// its toast with the new title.
export function buildXpResult(
  before: Stats,
  after: Stats,
  extra: { leveledUp: boolean; goalReached: boolean; claimedQuests: QuestDef[] }
) {
  const info = levelFromXp(after.totalXp);
  const beforeTier = rankFromLevel(levelFromXp(before.totalXp).level).tier;
  const rank = rankFromLevel(info.level);
  return {
    awarded: after.totalXp - before.totalXp,
    totalXp: after.totalXp,
    level: info.level,
    xpIntoLevel: info.xpIntoLevel,
    xpForNextLevel: info.xpForNextLevel,
    currentStreak: after.currentStreak,
    leveledUp: extra.leveledUp,
    rankUp: rank.tier > beforeTier,
    title: rank.title,
    goalReached: extra.goalReached,
    quests: extra.claimedQuests.map((q) => ({
      id: q.id,
      title: q.title,
      bonusXp: q.bonusXp,
    })),
  };
}
