// Scholar/language-adept rank ladder layered over the numeric level. A rank
// spans several levels so crossing one is a real "promotion". Ranks are derived
// purely from level (no storage). colorKey is a stable token the UI maps to
// Tailwind classes; the top tier is open-ended (nextLevel = null).

export interface Rank {
  tier: number;
  title: string;
  colorKey: string;
  minLevel: number;
}

export const RANKS: Rank[] = [
  { tier: 1, title: "Novice Reader", colorKey: "slate", minLevel: 1 },
  { tier: 2, title: "Word Apprentice", colorKey: "green", minLevel: 5 },
  { tier: 3, title: "Lexicon Adept", colorKey: "teal", minLevel: 10 },
  { tier: 4, title: "Vocabulary Scholar", colorKey: "blue", minLevel: 15 },
  { tier: 5, title: "Diction Savant", colorKey: "indigo", minLevel: 20 },
  { tier: 6, title: "Loremaster", colorKey: "violet", minLevel: 25 },
  { tier: 7, title: "Sage of Words", colorKey: "amber", minLevel: 30 },
  { tier: 8, title: "Archmage of Lexicon", colorKey: "gold", minLevel: 40 },
];

export interface RankInfo extends Rank {
  // The level at which the NEXT rank begins, or null at the open-ended top tier.
  nextLevel: number | null;
}

export function rankFromLevel(level: number): RankInfo {
  const lvl = Math.max(1, level);
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (lvl >= RANKS[i].minLevel) index = i;
  }
  const rank = RANKS[index];
  const next = RANKS[index + 1];
  return { ...rank, nextLevel: next ? next.minLevel : null };
}
