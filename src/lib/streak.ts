import { DAILY_GOAL_XP, levelFromXp } from "./xp";
import { claimReadyQuests, type QuestDef } from "./quests";

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
  // Daily quest tracking (all reset on the Taipei day rollover):
  newWordsToday: number; // words first-acquired today
  questionsToday: number; // questions completed for XP today
  questClaimedMask: number; // bitmask of quests whose bonus was claimed today
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
  newWordsToday: 0,
  questionsToday: 0,
  questClaimedMask: 0,
};

export interface ApplyXpResult {
  stats: Stats;
  leveledUp: boolean;
  goalReached: boolean;
}

export interface RecordResult extends ApplyXpResult {
  claimedQuests: QuestDef[];
}

export interface ActivityInput {
  baseXp: number;
  newWord?: boolean;
  question?: boolean;
}

// Weekly freeze refill + Taipei day rollover. Mutates `s` and returns whether a
// freeze was consumed to bridge a single missed day. Rollover resets todayXp and
// all daily quest counters/flags.
function rollover(
  s: Stats,
  today: string,
  yesterday: string,
  dayBeforeYesterday: string,
  weekKey: string
): boolean {
  if (s.freezeWeek !== weekKey) {
    s.freezeCredits = FREEZE_PER_WEEK;
    s.freezeWeek = weekKey;
  }

  let bridged = false;
  if (s.lastActiveDate !== today) {
    s.todayXp = 0;
    s.newWordsToday = 0;
    s.questionsToday = 0;
    s.questClaimedMask = 0;
    const hasGap =
      s.currentStreak > 0 && s.lastGoalDate !== "" && s.lastGoalDate !== yesterday;
    if (hasGap) {
      const singleMissedDay = s.lastGoalDate === dayBeforeYesterday;
      if (singleMissedDay && s.freezeCredits > 0) {
        s.freezeCredits -= 1;
        bridged = true;
      } else {
        s.currentStreak = 0;
      }
    }
    s.lastActiveDate = today;
  }
  return bridged;
}

// Advance the streak if today's goal is (newly) met. Mutates `s`, returns whether
// the goal was reached this call.
function evaluateGoal(
  s: Stats,
  today: string,
  yesterday: string,
  bridged: boolean
): boolean {
  if (s.todayXp >= DAILY_GOAL_XP && s.lastGoalDate !== today) {
    if (s.lastGoalDate === yesterday || bridged) s.currentStreak += 1;
    else s.currentStreak = 1;
    s.lastGoalDate = today;
    s.longestStreak = Math.max(s.longestStreak, s.currentStreak);
    return true;
  }
  return false;
}

// Pure reducer for a plain XP award (no quests). Kept for the streak/freeze unit
// tests and any caller that only needs base XP accrual.
export function applyXp(
  prev: Stats,
  amount: number,
  today: string,
  yesterday: string,
  dayBeforeYesterday: string,
  weekKey: string
): ApplyXpResult {
  const s: Stats = { ...prev };
  const prevLevel = levelFromXp(s.totalXp).level;
  const bridged = rollover(s, today, yesterday, dayBeforeYesterday, weekKey);
  s.totalXp += amount;
  s.todayXp += amount;
  const goalReached = evaluateGoal(s, today, yesterday, bridged);
  const leveledUp = levelFromXp(s.totalXp).level > prevLevel;
  return { stats: s, leveledUp, goalReached };
}

// Full activity reducer: accrues base XP, bumps quest counters, claims any newly
// completed quests (adding their bonus XP), THEN evaluates the daily goal on the
// final todayXp — so quest bonuses correctly count toward the goal and streak.
export function recordActivity(
  prev: Stats,
  input: ActivityInput,
  today: string,
  yesterday: string,
  dayBeforeYesterday: string,
  weekKey: string
): RecordResult {
  const s: Stats = { ...prev };
  const prevLevel = levelFromXp(s.totalXp).level;
  const bridged = rollover(s, today, yesterday, dayBeforeYesterday, weekKey);

  s.totalXp += input.baseXp;
  s.todayXp += input.baseXp;
  if (input.newWord) s.newWordsToday += 1;
  if (input.question) s.questionsToday += 1;

  const claimedQuests = claimReadyQuests(s);

  const goalReached = evaluateGoal(s, today, yesterday, bridged);
  const leveledUp = levelFromXp(s.totalXp).level > prevLevel;
  return { stats: s, leveledUp, goalReached, claimedQuests };
}
