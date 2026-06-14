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
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Question Bank
        </h1>
        <p className="mt-1 text-muted">
          Pick a passage and complete the words against the clock.
        </p>
      </header>

      {questions.length === 0 && errors.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">
          No questions yet. Ask Claude Code to generate some into{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5">questions/</code>.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {questions.map((q) => (
          <Link
            key={q.file}
            href={`/practice/${q.file}`}
            className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm transition hover:border-accent hover:shadow-md"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-fg">
                {q.question.topic}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {q.question.blanks.length} blanks
              </p>
            </div>
            <span className="text-muted transition group-hover:translate-x-0.5 group-hover:text-accent">
              →
            </span>
          </Link>
        ))}
      </div>

      {errors.length > 0 && (
        <div className="mt-6 rounded-xl border border-bad/40 bg-bad-soft p-4">
          <h2 className="font-semibold text-bad">Invalid files</h2>
          <ul className="mt-1 space-y-1 text-sm text-bad">
            {errors.map((e) => (
              <li key={e.file}>
                {e.file}: {e.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
