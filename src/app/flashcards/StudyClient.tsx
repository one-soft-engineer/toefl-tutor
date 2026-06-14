"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReviewResult } from "@/lib/leitner";

export interface StudyCard {
  word: string;
  hint?: string;
  example: string;
  topic: string;
  box: number;
  isWrong: boolean;
}

export function StudyClient({
  deck,
  backHref,
}: {
  deck: StudyCard[];
  backHref: string;
}) {
  const [queue, setQueue] = useState<StudyCard[]>(deck);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState({ reviewed: 0, mastered: 0 });

  const current = queue[0];

  async function grade(result: ReviewResult) {
    if (!current || busy) return;
    setBusy(true);
    let mastered = false;
    try {
      const res = await fetch("/api/flashcards/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: current.word, result }),
      });
      const data = (await res.json().catch(() => ({}))) as { mastered?: boolean };
      mastered = !!data.mastered;
    } catch {
      // Network failure: still advance; progress just won't persist this time.
    }
    setStats((s) => ({
      reviewed: s.reviewed + 1,
      mastered: s.mastered + (mastered ? 1 : 0),
    }));
    setQueue((q) => {
      const [head, ...rest] = q;
      return result === "again" ? [...rest, head] : rest;
    });
    setFlipped(false);
    setBusy(false);
  }

  if (deck.length === 0) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold">Flashcards</h1>
        <p className="text-gray-600">Nothing due right now. Nicely done!</p>
        <Link className="text-toefl underline" href={backHref}>
          ← Back
        </Link>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold">Session complete</h1>
        <p className="text-gray-700">
          Reviewed {stats.reviewed} card{stats.reviewed === 1 ? "" : "s"}
          {stats.mastered > 0 && ` · mastered ${stats.mastered}`}.
        </p>
        <Link className="text-toefl underline" href={backHref}>
          ← Back
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{queue.length} left</span>
        <Link className="underline" href={backHref}>
          Exit
        </Link>
      </div>

      <div className="min-h-[16rem] rounded-xl border border-gray-300 bg-white p-6 shadow-sm flex flex-col">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-500">
            {current.topic}
          </span>
          {current.isWrong && (
            <span className="rounded bg-red-100 px-2 py-0.5 text-red-700">
              wrong before
            </span>
          )}
          <span className="ml-auto text-gray-400">box {current.box}</span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6 text-center">
          {!flipped ? (
            <>
              <p className="text-xs uppercase tracking-wide text-gray-400">
                Meaning
              </p>
              <p className="text-xl text-gray-900">
                {current.hint ?? `Recall the ${current.topic} word.`}
              </p>
            </>
          ) : (
            <>
              <p className="font-mono text-3xl font-bold text-toefl">
                {current.word}
              </p>
              <p className="text-gray-700">{current.example}</p>
            </>
          )}
        </div>
      </div>

      {!flipped ? (
        <button
          className="w-full rounded bg-toefl px-4 py-3 font-medium text-white hover:bg-toefl-light active:bg-toefl-dark"
          onClick={() => setFlipped(true)}
        >
          Show answer
        </button>
      ) : (
        <div className="flex gap-3">
          <button
            disabled={busy}
            className="flex-1 rounded border-2 border-red-300 bg-red-50 px-4 py-3 font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            onClick={() => grade("again")}
          >
            Again
          </button>
          <button
            disabled={busy}
            className="flex-1 rounded border-2 border-green-300 bg-green-50 px-4 py-3 font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
            onClick={() => grade("got")}
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
