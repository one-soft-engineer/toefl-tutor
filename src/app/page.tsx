import Link from "next/link";
import { redirect } from "next/navigation";
import { isLocalMode } from "@/lib/env";
import { loadAllQuestions } from "@/lib/load-questions";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isLocalMode()) {
    redirect("/review");
  }

  const { questions, errors } = await loadAllQuestions();

  return (
    <main className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">Local Question Bank</h1>
        <Link className="text-sm text-blue-600 underline" href="/words">
          Words →
        </Link>
      </div>

      {questions.length === 0 && errors.length === 0 && (
        <p className="text-gray-500">
          No questions yet. Ask Claude Code to generate some into{" "}
          <code>questions/</code>.
        </p>
      )}

      <ul className="space-y-2">
        {questions.map((q) => (
          <li key={q.file}>
            <Link
              className="text-blue-600 underline"
              href={`/practice/${q.file}`}
            >
              {q.question.topic} — {q.file}
            </Link>
          </li>
        ))}
      </ul>

      {errors.length > 0 && (
        <div>
          <h2 className="text-red-600 font-semibold">Invalid files</h2>
          <ul className="space-y-1">
            {errors.map((e) => (
              <li key={e.file} className="text-red-600 text-sm">
                {e.file}: {e.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
