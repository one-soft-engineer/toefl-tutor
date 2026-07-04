// Rank color tokens -> Tailwind classes. Static string literals so Tailwind's
// content scan keeps them. Shared by the status bar and the character sheet.
export const RANK_BADGE: Record<string, string> = {
  slate: "bg-slate-500 text-white",
  green: "bg-green-600 text-white",
  teal: "bg-teal-600 text-white",
  blue: "bg-blue-600 text-white",
  indigo: "bg-indigo-600 text-white",
  violet: "bg-violet-600 text-white",
  amber: "bg-amber-500 text-white",
  gold: "bg-yellow-500 text-black",
};

export function rankBadgeClass(colorKey: string): string {
  return RANK_BADGE[colorKey] ?? RANK_BADGE.slate;
}
