import { getDb } from "@/db/client";
import { cardProgress } from "@/db/schema";
import { MAX_BOX } from "@/lib/leitner";
import { getOrCreateStats } from "@/lib/stats-store";
import { levelFromXp } from "@/lib/xp";
import { rankFromLevel, RANKS } from "@/lib/rank";
import { questStatuses } from "@/lib/quests";
import { rankBadgeClass } from "@/components/rank-style";

export const dynamic = "force-dynamic";

export default async function CharacterPage() {
  const db = getDb();
  const [stats, boxes] = await Promise.all([
    getOrCreateStats(db),
    db.select({ box: cardProgress.box }).from(cardProgress),
  ]);

  const { level, xpIntoLevel, xpForNextLevel } = levelFromXp(stats.totalXp);
  const rank = rankFromLevel(level);
  const pct = xpForNextLevel
    ? Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100))
    : 100;

  const mastered = boxes.filter((b) => b.box >= MAX_BOX).length;
  const inStudy = boxes.filter((b) => b.box < MAX_BOX).length;
  const quests = questStatuses(stats);

  const attributes = [
    { label: "Mastery", hint: "words fully mastered", value: mastered },
    { label: "In study", hint: "words in progress", value: inStudy },
    {
      label: "Resolve",
      hint: "current / longest streak",
      value: `${stats.currentStreak} / ${stats.longestStreak}`,
    },
    { label: "Total mastery", hint: "lifetime XP", value: stats.totalXp },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Hero header */}
      <header className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <span
            className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl text-lg font-bold ${rankBadgeClass(rank.colorKey)}`}
            title={`Tier ${rank.tier}`}
          >
            Lv{level}
          </span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted">
              Rank {rank.tier} of {RANKS.length}
            </p>
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {rank.title}
            </h1>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>Level {level}</span>
            <span className="tabular-nums">
              {rank.nextLevel
                ? `${xpIntoLevel}/${xpForNextLevel} XP to Lv${level + 1}`
                : "Max rank reached"}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </header>

      {/* Attributes */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-muted">Attributes</h2>
        <div className="grid grid-cols-2 gap-3">
          {attributes.map((a) => (
            <div
              key={a.label}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <p className="text-2xl font-bold tabular-nums text-fg">{a.value}</p>
              <p className="mt-0.5 text-sm font-medium text-fg">{a.label}</p>
              <p className="text-xs text-muted">{a.hint}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Daily quests */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-muted">
          Daily quests
        </h2>
        <div className="space-y-2">
          {quests.map((q) => (
            <div
              key={q.def.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm ${
                  q.claimed
                    ? "bg-ok-soft text-ok"
                    : q.done
                      ? "bg-accent-soft text-accent"
                      : "bg-surface-2 text-muted"
                }`}
                aria-hidden="true"
              >
                {q.claimed || q.done ? "✓" : "◦"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-fg">{q.def.title}</p>
                <p className="text-xs text-muted">{q.def.flavor}</p>
              </div>
              <span className="shrink-0 text-right text-xs">
                <span className="tabular-nums text-muted">
                  {q.current}/{q.target}
                </span>
                <span className="block text-[11px] text-muted">
                  {q.claimed ? `+${q.def.bonusXp} XP` : `reward ${q.def.bonusXp} XP`}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Rank ladder */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-muted">Rank ladder</h2>
        <ol className="space-y-1.5">
          {RANKS.map((r) => {
            const state =
              r.tier < rank.tier
                ? "passed"
                : r.tier === rank.tier
                  ? "current"
                  : "locked";
            return (
              <li
                key={r.tier}
                className={`flex items-center gap-3 rounded-lg border p-2.5 ${
                  state === "current"
                    ? "border-accent bg-accent-soft"
                    : "border-border bg-surface"
                } ${state === "locked" ? "opacity-50" : ""}`}
              >
                <span
                  className={`h-3 w-3 shrink-0 rounded-full ${rankBadgeClass(r.colorKey)}`}
                  aria-hidden="true"
                />
                <span className="flex-1 text-sm font-medium text-fg">
                  {r.title}
                </span>
                <span className="text-xs tabular-nums text-muted">
                  {state === "passed" ? "✓ " : ""}
                  Lv{r.minLevel}
                  {r.tier === RANKS.length ? "+" : ""}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
