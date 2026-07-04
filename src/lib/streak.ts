import { DAILY_GOAL_XP, levelFromXp } from "./xp";

export const FREEZE_PER_WEEK = 1;

export interface Stats {
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // "YYYY-MM-DD" (Taipei), last day any XP was earned
  lastGoalDate: string; // "YYYY-MM-DD" (Taipei), last day the goal was met
  todayXp: number; // XP earned on lastActiveDate
  freezeCredits: number; // buffer to bridge one missed day
  freezeWeek: string; // week bucket the freeze was last refilled in
}

export const INITIAL_STATS: Stats = {
  totalXp: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: "",
  lastGoalDate: "",
  todayXp: 0,
  freezeCredits: 0,
  freezeWeek: "",
};

export interface ApplyXpResult {
  stats: Stats;
  leveledUp: boolean;
  goalReached: boolean;
}

// Pure reducer: given previous stats and an XP amount earned "today" (a Taipei
// date string), return the next stats plus whether we leveled up / hit the goal.
// Dates are injected so this stays fully deterministic and unit-testable.
export function applyXp(
  prev: Stats,
  amount: number,
  today: string,
  yesterday: string,
  weekKey: string
): ApplyXpResult {
  const s: Stats = { ...prev };
  const prevLevel = levelFromXp(s.totalXp).level;

  // Weekly freeze refill.
  if (s.freezeWeek !== weekKey) {
    s.freezeCredits = FREEZE_PER_WEEK;
    s.freezeWeek = weekKey;
  }

  // Day rollover: reset today's XP and decide whether the streak survived a gap.
  let bridged = false;
  if (s.lastActiveDate !== today) {
    s.todayXp = 0;
    const missedFullDay =
      s.currentStreak > 0 && s.lastGoalDate !== "" && s.lastGoalDate < yesterday;
    if (missedFullDay) {
      if (s.freezeCredits > 0) {
        s.freezeCredits -= 1;
        bridged = true; // freeze keeps the streak alive across the gap
      } else {
        s.currentStreak = 0;
      }
    }
    s.lastActiveDate = today;
  }

  // Accrue XP.
  s.totalXp += amount;
  s.todayXp += amount;

  // Daily goal -> advance the streak (once per day).
  let goalReached = false;
  if (s.todayXp >= DAILY_GOAL_XP && s.lastGoalDate !== today) {
    if (s.lastGoalDate === yesterday || bridged) s.currentStreak += 1;
    else s.currentStreak = 1;
    s.lastGoalDate = today;
    s.longestStreak = Math.max(s.longestStreak, s.currentStreak);
    goalReached = true;
  }

  const leveledUp = levelFromXp(s.totalXp).level > prevLevel;
  return { stats: s, leveledUp, goalReached };
}
