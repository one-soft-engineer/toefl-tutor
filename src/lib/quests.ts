import { DAILY_GOAL_XP } from "./xp";
import type { Stats } from "./streak";

// Daily quests, reset at the Taipei day rollover. Each grants a one-time bonus
// XP when its target is met. `bit` is the quest's slot in Stats.questClaimedMask.
export interface QuestDef {
  id: "daily-drill" | "new-acquisition" | "trial";
  title: string;
  flavor: string;
  target: number;
  bonusXp: number;
  bit: number;
}

export const QUESTS: QuestDef[] = [
  {
    id: "daily-drill",
    title: "Daily Drill",
    flavor: "Earn the day's mastery.",
    target: DAILY_GOAL_XP,
    bonusXp: 10,
    bit: 1,
  },
  {
    id: "new-acquisition",
    title: "New Acquisition",
    flavor: "Claim a word never yet mastered.",
    target: 1,
    bonusXp: 10,
    bit: 2,
  },
  {
    id: "trial",
    title: "Trial",
    flavor: "Complete a full passage.",
    target: 1,
    bonusXp: 10,
    bit: 4,
  },
];

// How far along a quest is, given today's counters on Stats.
function questCurrent(id: QuestDef["id"], s: Stats): number {
  switch (id) {
    case "daily-drill":
      return s.todayXp;
    case "new-acquisition":
      return s.newWordsToday;
    case "trial":
      return s.questionsToday;
  }
}

// Claim every quest whose target is met and whose bonus hasn't been granted today.
// Mutates `s` (sets the claimed bit, adds bonus XP). Loops until stable because a
// bonus can push todayXp over the Daily Drill target within the same call.
export function claimReadyQuests(s: Stats): QuestDef[] {
  const claimed: QuestDef[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const q of QUESTS) {
      if ((s.questClaimedMask & q.bit) !== 0) continue;
      if (questCurrent(q.id, s) >= q.target) {
        s.questClaimedMask |= q.bit;
        s.totalXp += q.bonusXp;
        s.todayXp += q.bonusXp;
        claimed.push(q);
        changed = true;
      }
    }
  }
  return claimed;
}

export interface QuestStatus {
  def: QuestDef;
  current: number;
  target: number;
  done: boolean;
  claimed: boolean;
}

// Read-only view of each quest for the character sheet. `current` is capped at
// the target so a progress bar never overshoots.
export function questStatuses(s: Stats): QuestStatus[] {
  return QUESTS.map((q) => {
    const current = Math.min(questCurrent(q.id, s), q.target);
    return {
      def: q,
      current,
      target: q.target,
      done: current >= q.target,
      claimed: (s.questClaimedMask & q.bit) !== 0,
    };
  });
}
