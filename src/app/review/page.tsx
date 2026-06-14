import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { questions, attempts } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function ReviewList({
  searchParams,
}: {
  searchParams: Promise<{ wrongOnly?: string }>;
}) {
  const { wrongOnly } = await searchParams;
  const onlyWrong = wrongOnly === "1";
  const db = getDb();

  let questionIds: string[] | null = null;
  if (onlyWrong) {
    const rows = await db
      .select({ id: attempts.questionId, score: attempts.score })
      .from(attempts);
    const qs = await db
      .select({ id: questions.id, blanks: questions.blanks })
      .from(questions);
    const blanksByQuestion = new Map<string, number>();
    for (const q of qs) blanksByQuestion.set(q.id, q.blanks.length);
    const wrongSet = new Set<string>();
    for (const r of rows) {
      const total = blanksByQuestion.get(r.id) ?? Infinity;
      if (r.score < total) wrongSet.add(r.id);
    }
    questionIds = [...wrongSet];
  }

  const list = questionIds
    ? questionIds.length
      ? await db
          .select()
          .from(questions)
          .where(inArray(questions.id, questionIds))
          .orderBy(desc(questions.createdAt))
      : []
    : await db.select().from(questions).orderBy(desc(questions.createdAt));

  const pill = (active: boolean) =>
    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors " +
    (active
      ? "bg-accent text-accent-fg"
      : "bg-surface-2 text-muted hover:text-fg");

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Review</h1>
        <p className="mt-1 text-muted">Replay questions you have practised.</p>
      </header>

      <div className="mb-4 flex gap-2">
        <Link href="/review" className={pill(!onlyWrong)}>
          All
        </Link>
        <Link href="/review?wrongOnly=1" className={pill(onlyWrong)}>
          Answered wrong
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((q) => (
          <Link
            key={q.id}
            href={`/review/${q.id}`}
            className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm transition hover:border-accent hover:shadow-md"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-fg">{q.topic}</p>
              <p className="mt-0.5 text-sm text-muted">
                {new Date(q.createdAt).toLocaleDateString()}
              </p>
            </div>
            <span className="text-muted transition group-hover:translate-x-0.5 group-hover:text-accent">
              →
            </span>
          </Link>
        ))}
      </div>

      {list.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">
          Nothing here yet.
        </div>
      )}
    </main>
  );
}
