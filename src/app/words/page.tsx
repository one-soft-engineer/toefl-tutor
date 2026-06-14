import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { questions, attempts, wrongWords } from "@/db/schema";
import { isLocalMode } from "@/lib/env";
import { loadAllQuestions } from "@/lib/load-questions";
import { classifyWords, type BankWord, type WordStatus } from "@/lib/words";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<WordStatus, { label: string; cls: string }> = {
  wrong: { label: "Wrong", cls: "bg-bad-soft text-bad" },
  correct: { label: "Learned", cls: "bg-ok-soft text-ok" },
  unpracticed: { label: "Not practiced", cls: "bg-surface-2 text-muted" },
};

async function gatherBank(): Promise<BankWord[]> {
  const db = getDb();
  if (isLocalMode()) {
    // Local: the authored JSON files are the full question bank.
    const { questions: loaded } = await loadAllQuestions();
    return loaded.flatMap((q) =>
      q.question.blanks.map((b) => ({
        word: b.answer,
        topic: q.question.topic,
        passage: q.question.passage,
      }))
    );
  }
  // Cloud: the persisted questions table is the bank.
  const rows = await db
    .select({
      passage: questions.passage,
      blanks: questions.blanks,
      topic: questions.topic,
    })
    .from(questions);
  return rows.flatMap((r) =>
    r.blanks.map((b) => ({
      word: b.answer,
      topic: r.topic,
      passage: r.passage,
    }))
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "fg" | "bad" | "ok";
}) {
  const color =
    tone === "bad" ? "text-bad" : tone === "ok" ? "text-ok" : "text-fg";
  return (
    <div className="flex-1 rounded-xl border border-border bg-surface px-4 py-3">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

export default async function WordsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const wrongOnly = filter === "wrong";
  const db = getDb();

  const [bank, practicedRows, wrongRows] = await Promise.all([
    gatherBank(),
    db
      .select({ passage: questions.passage })
      .from(questions)
      .innerJoin(attempts, eq(attempts.questionId, questions.id)),
    db.select().from(wrongWords),
  ]);

  const practicedPassages = new Set(practicedRows.map((r) => r.passage));
  const wrongCounts = new Map(wrongRows.map((w) => [w.word, w.wrongCount]));

  const all = classifyWords(bank, practicedPassages, wrongCounts);
  const rows = wrongOnly ? all.filter((r) => r.status === "wrong") : all;

  const counts = {
    total: all.length,
    wrong: all.filter((r) => r.status === "wrong").length,
    learned: all.filter((r) => r.status === "correct").length,
  };

  const pill = (active: boolean) =>
    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors " +
    (active
      ? "bg-accent text-accent-fg"
      : "bg-surface-2 text-muted hover:text-fg");

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Words</h1>
        <p className="mt-1 text-muted">Every word in the bank, wrong ones first.</p>
      </header>

      <div className="mb-5 flex gap-3">
        <Stat label="Total" value={counts.total} tone="fg" />
        <Stat label="Wrong" value={counts.wrong} tone="bad" />
        <Stat label="Learned" value={counts.learned} tone="ok" />
      </div>

      <div className="mb-4 flex gap-2">
        <Link href="/words" className={pill(!wrongOnly)}>
          All
        </Link>
        <Link href="/words?filter=wrong" className={pill(wrongOnly)}>
          Wrong only
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Word</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium whitespace-nowrap">Wrong</th>
                <th className="px-4 py-3 font-medium">Topic</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const s = STATUS_STYLE[r.status];
                return (
                  <tr key={r.word} className="hover:bg-surface-2">
                    <td
                      className={`px-4 py-3 font-mono whitespace-nowrap ${
                        r.status === "wrong" ? "font-semibold text-bad" : "text-fg"
                      }`}
                    >
                      {r.word}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs whitespace-nowrap ${s.cls}`}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-muted">
                      {r.wrongCount || ""}
                    </td>
                    <td className="px-4 py-3 text-muted">{r.topic}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p className="p-8 text-center text-muted">
            {wrongOnly ? "No wrong words yet." : "No words yet."}
          </p>
        )}
      </div>
    </main>
  );
}
