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
      <p className="text-lg leading-relaxed">{question.passage}</p>

      <ol className="space-y-3">
        {question.blanks.map((b) => {
          const a = answerFor(b.index);
          return (
            <li key={b.index} className="flex items-center gap-2">
              <span className="font-mono">{b.shown}</span>
              <input
                className="border rounded px-2 py-1 font-mono"
                value={typed[b.index] ?? ""}
                disabled={!!result}
                onChange={(e) =>
                  setTyped((t) => ({ ...t, [b.index]: e.target.value }))
                }
                placeholder="missing letters"
              />
              {showHints && b.hint && (
                <span className="text-sm text-gray-500">({b.hint})</span>
              )}
              {a && (
                <span className={a.correct ? "text-green-600" : "text-red-600"}>
                  {a.correct ? "✓" : `✗ ${b.answer}`}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {!result && mode === "answer" && (
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
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
