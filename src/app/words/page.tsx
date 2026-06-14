import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { questions, attempts, wrongWords } from "@/db/schema";
import { isLocalMode } from "@/lib/env";
import { loadAllQuestions } from "@/lib/load-questions";
import { classifyWords, type BankWord, type WordStatus } from "@/lib/words";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<WordStatus, { label: string; cls: string }> = {
  wrong: { label: "Wrong", cls: "bg-red-100 text-red-700" },
  correct: { label: "Learned", cls: "bg-green-100 text-green-700" },
  unpracticed: { label: "Not practiced", cls: "bg-gray-100 text-gray-500" },
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

  const backHref = isLocalMode() ? "/" : "/review";

  return (
    <main className="w-full max-w-2xl lg:max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
      <h1 className="text-2xl font-bold">Words</h1>

      <p className="text-sm text-gray-600">
        {counts.total} total · <span className="text-red-600">{counts.wrong} wrong</span> ·{" "}
        <span className="text-green-600">{counts.learned} learned</span>
      </p>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link className="underline" href="/words">
          All
        </Link>
        <Link className="underline" href="/words?filter=wrong">
          Wrong only
        </Link>
        <Link className="underline" href="/flashcards">
          Flashcards
        </Link>
        <Link className="underline" href={backHref}>
          ← Back
        </Link>
      </div>

      <div className="-mx-4 sm:mx-0 overflow-x-auto">
        <table className="w-full min-w-[22rem] text-left">
          <thead>
            <tr className="border-b">
              <th className="px-4 sm:px-0 py-2">Word</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2 whitespace-nowrap">Wrong ×</th>
              <th className="px-4 sm:px-0 py-2">Topic</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const s = STATUS_STYLE[r.status];
              return (
                <tr key={r.word} className="border-b">
                  <td
                    className={`px-4 sm:px-0 py-2 font-mono whitespace-nowrap ${
                      r.status === "wrong" ? "font-semibold text-red-700" : ""
                    }`}
                  >
                    {r.word}
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs whitespace-nowrap ${s.cls}`}
                    >
                      {s.label}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    {r.wrongCount || ""}
                  </td>
                  <td className="px-4 sm:px-0 py-2 text-gray-600">{r.topic}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <p className="text-gray-500">
          {wrongOnly ? "No wrong words yet." : "No words yet."}
        </p>
      )}
    </main>
  );
}
