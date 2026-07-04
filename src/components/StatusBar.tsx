import Link from "next/link";
import { getDb } from "@/db/client";
import { getOrCreateStats } from "@/lib/stats-store";
import { INITIAL_STATS } from "@/lib/streak";
import { levelFromXp, DAILY_GOAL_XP } from "@/lib/xp";
import { rankFromLevel } from "@/lib/rank";
import { rankBadgeClass } from "@/components/rank-style";

// Server component: reads the single stats row and renders the persistent
// rank / XP-progress / streak strip. The whole bar links to the character sheet.
// Re-rendered on router.refresh() after an award writes XP.
export async function StatusBar() {
  // Degrade gracefully if the DB is unreachable (e.g. static prerender of
  // /_not-found at build time): show a neutral bar rather than failing.
  let stats = INITIAL_STATS;
  try {
    stats = await getOrCreateStats(getDb());
  } catch {
    // keep INITIAL_STATS
  }
  const { level, xpIntoLevel, xpForNextLevel } = levelFromXp(stats.totalXp);
  const rank = rankFromLevel(level);
  const pct = xpForNextLevel
    ? Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100))
    : 0;
  const goalPct = Math.min(100, Math.round((stats.todayXp / DAILY_GOAL_XP) * 100));

  return (
    <Link
      href="/character"
      className="block border-b border-border bg-surface/60 hover:bg-surface-2/60"
      aria-label={`${rank.title}, level ${level} — open character sheet`}
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-1.5 text-xs sm:px-6">
        <span
          className={`grid h-6 min-w-6 place-items-center rounded-md px-1.5 text-[11px] font-bold ${rankBadgeClass(rank.colorKey)}`}
          title={`${rank.title} · Level ${level}`}
        >
          Lv{level}
        </span>
        <span className="hidden shrink-0 font-medium text-fg sm:inline">
          {rank.title}
        </span>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={xpForNextLevel}
            aria-valuenow={xpIntoLevel}
            aria-label="XP to next level"
          >
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="hidden shrink-0 tabular-nums text-muted sm:inline">
            {xpIntoLevel}/{xpForNextLevel} XP
          </span>
        </div>

        <span
          className="shrink-0 tabular-nums text-muted"
          title={`Today ${stats.todayXp}/${DAILY_GOAL_XP} XP · goal ${goalPct}%`}
        >
          🔥 {stats.currentStreak}
        </span>
      </div>
    </Link>
  );
}
