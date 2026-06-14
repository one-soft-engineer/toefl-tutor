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
  const db = getDb();

  let questionIds: string[] | null = null;
  if (wrongOnly === "1") {
    // A question counts as "answered wrong" when an attempt's score is below
    // its number of blanks.
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

  return (
    <main className="w-full max-w-2xl mx-auto p-4 sm:p-8 space-y-6">
      <h1 className="text-2xl font-bold">Review</h1>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link className="underline" href="/review">
          All
        </Link>
        <Link className="underline" href="/review?wrongOnly=1">
          Answered wrong
        </Link>
        <Link className="underline" href="/words">
          Words
        </Link>
        <Link className="underline" href="/flashcards">
          Flashcards
        </Link>
      </div>
      <ul className="space-y-2">
        {list.map((q) => (
          <li key={q.id}>
            <Link className="text-blue-600 underline" href={`/review/${q.id}`}>
              {q.topic} — {new Date(q.createdAt).toLocaleDateString()}
            </Link>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="text-gray-500">Nothing here yet.</p>}
    </main>
  );
}
