"use client";

import { useState } from "react";
import type { Question, BlankAnswer } from "@/lib/types";
import { gradeAttempt, type GradeResult } from "@/lib/grade";

interface Props {
  question: Question;
  mode: "answer" | "review";
  showHints?: boolean;
  onGraded?: (result: GradeResult) => void;
}

export function CompleteTheWords({ question, mode, showHints, onGraded }: Props) {
  const [typed, setTyped] = useState<Record<number, string>>({});
  const [result, setResult] = useState<GradeResult | null>(null);

  function submit() {
    const r = gradeAttempt(question, typed);
    setResult(r);
    onGraded?.(r);
  }

  function answerFor(index: number): BlankAnswer | undefined {
    return result?.answers.find((a) => a.index === index);
  }

  return (
    <div className="space-y-6">
      <p className="text-base sm:text-lg leading-relaxed break-words">
        {question.passage}
      </p>

      <ol className="space-y-3">
        {question.blanks.map((b) => {
          const a = answerFor(b.index);
          return (
            <li
              key={b.index}
              className="flex flex-wrap items-center gap-x-2 gap-y-1"
            >
              <span className="font-mono">{b.shown}</span>
              <input
                className="min-w-0 flex-1 sm:flex-none sm:w-44 border rounded px-3 py-2 font-mono"
                value={typed[b.index] ?? ""}
                disabled={!!result}
                onChange={(e) =>
                  setTyped((t) => ({ ...t, [b.index]: e.target.value }))
                }
                placeholder="missing letters"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              {showHints && b.hint && (
                <span className="text-sm text-gray-500">({b.hint})</span>
              )}
              {a && (
                <span
                  className={
                    "break-all " +
                    (a.correct ? "text-green-600" : "text-red-600")
                  }
                >
                  {a.correct ? "✓" : `✗ ${b.answer}`}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {!result && mode === "answer" && (
        <button
          className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2.5 rounded active:bg-blue-700"
          onClick={submit}
        >
          Submit
        </button>
      )}

      {result && (
        <p className="font-semibold">
          Score: {result.score} / {result.total}
        </p>
      )}
    </div>
  );
}
