"use client";

// Shared transient "+X XP" cue used after a flashcard review or a question
// completion. Flavors the message with a rank-up title, a level-up, and any
// daily quests claimed by the action.
export interface XpToastData {
  amount: number;
  leveledUp: boolean;
  rankUp: boolean;
  title: string;
  quests: { title: string }[];
}

export function XpToast({ data }: { data: XpToastData }) {
  const badge = data.rankUp
    ? ` · ${data.title}! 🎖️`
    : data.leveledUp
      ? " · Level up! 🎉"
      : "";

  return (
    <div
      className="pointer-events-none fixed left-1/2 top-20 z-30 -translate-x-1/2"
      aria-live="polite"
    >
      <div className="animate-[fadeUp_1.8s_ease-out] rounded-2xl bg-accent px-4 py-1.5 text-center text-sm font-semibold text-accent-fg shadow-lg">
        +{data.amount} XP{badge}
        {data.quests.length > 0 && (
          <span className="block text-xs font-normal opacity-90">
            Quest{data.quests.length > 1 ? "s" : ""}:{" "}
            {data.quests.map((q) => q.title).join(", ")} ✓
          </span>
        )}
      </div>
    </div>
  );
}
