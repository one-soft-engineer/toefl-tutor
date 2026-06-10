"use client";

import { Fragment, useState } from "react";
import type { Question, Blank, BlankAnswer } from "@/lib/types";
import { gradeAttempt, type GradeResult } from "@/lib/grade";
import { splitPassage, missingLength } from "@/lib/passage";

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

  // A blank renders its shown prefix, then an input whose width/placeholder
  // shows exactly how many letters are missing (countable underscores).
  function renderBlank(b: Blank) {
    const missing = missingLength(b.shown, b.answer);
    const a = answerFor(b.index);
    return (
      <span className="inline-flex items-baseline whitespace-nowrap">
        <span className="font-mono">{b.shown}</span>
        <input
          className="font-mono tracking-[0.35em] text-center border-b-2 border-gray-400 bg-transparent px-1 focus:border-blue-600 focus:outline-none disabled:opacity-100"
          size={missing + 1}
          maxLength={missing}
          placeholder={"_".repeat(missing)}
          value={typed[b.index] ?? ""}
          disabled={!!result}
          onChange={(e) =>
            setTyped((t) => ({ ...t, [b.index]: e.target.value }))
          }
          aria-label={`blank ${b.index + 1}`}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        {a && (
          <span
            className={
              "ml-1 break-all " +
              (a.correct ? "text-green-600" : "text-red-600")
            }
          >
            {a.correct ? "✓" : `✗ ${b.answer}`}
          </span>
        )}
      </span>
    );
  }

  const { inline, segments } = splitPassage(
    question.passage,
    question.blanks.length
  );

  return (
    <div className="space-y-6">
      {inline ? (
        <p className="text-base sm:text-lg leading-loose break-words">
          {segments.map((seg, i) => (
            <Fragment key={i}>
              {seg}
              {i < question.blanks.length && renderBlank(question.blanks[i])}
            </Fragment>
          ))}
        </p>
      ) : (
        <>
          <p className="text-base sm:text-lg leading-relaxed break-words">
            {question.passage}
          </p>
          <ol className="space-y-3">
            {question.blanks.map((b) => (
              <li
                key={b.index}
                className="flex flex-wrap items-center gap-x-2 gap-y-1"
              >
                {renderBlank(b)}
                {showHints && b.hint && (
                  <span className="text-sm text-gray-500">({b.hint})</span>
                )}
              </li>
            ))}
          </ol>
        </>
      )}

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
