"use client";

import { Fragment, useEffect, useState } from "react";
import type { Question, Blank, BlankAnswer } from "@/lib/types";
import { gradeAttempt, type GradeResult } from "@/lib/grade";
import { splitPassage, missingLength } from "@/lib/passage";
import { formatClock } from "@/lib/time";

interface Props {
  question: Question;
  mode: "answer" | "review";
  showHints?: boolean;
  /** Render the TOEFL-style exam shell (header, countdown timer, action bar). */
  exam?: boolean;
  /** Countdown length in seconds for exam mode (default 180 = 3 minutes). */
  durationSeconds?: number;
  onGraded?: (result: GradeResult) => void;
}

export function CompleteTheWords({
  question,
  mode,
  showHints,
  exam = false,
  durationSeconds = 180,
  onGraded,
}: Props) {
  const [typed, setTyped] = useState<Record<number, string>>({});
  const [result, setResult] = useState<GradeResult | null>(null);
  const [remaining, setRemaining] = useState(durationSeconds);

  function submit() {
    setResult((prev) => {
      if (prev) return prev; // already graded (e.g. timer + click race)
      const r = gradeAttempt(question, typed);
      onGraded?.(r);
      return r;
    });
  }

  // Exam countdown: tick once per second; the final tick (reaching 0) submits
  // from inside the timer callback so no setState runs synchronously in the
  // effect body. Stops once graded.
  useEffect(() => {
    if (!exam || result || remaining <= 0) return;
    const id = setTimeout(() => {
      const next = remaining - 1;
      setRemaining(next);
      if (next <= 0) submit();
    }, 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam, result, remaining]);

  function answerFor(index: number): BlankAnswer | undefined {
    return result?.answers.find((a) => a.index === index);
  }

  // A blank renders its shown prefix, then a small box whose width/underscores
  // show exactly how many letters are missing.
  function renderBlank(b: Blank) {
    const missing = missingLength(b.shown, b.answer);
    const a = answerFor(b.index);
    const state = a
      ? a.correct
        ? "border-green-500 text-green-700"
        : "border-red-500 text-red-700"
      : "border-gray-400";
    return (
      <span className="inline-flex items-baseline whitespace-nowrap align-baseline">
        <span className="font-mono">{b.shown}</span>
        <input
          className={`font-mono tracking-[0.35em] text-center bg-white border rounded-sm px-1 py-0.5 focus:border-[#13395e] focus:outline-none focus:ring-1 focus:ring-[#13395e] disabled:opacity-100 ${state}`}
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
        {a && !a.correct && (
          <span className="ml-1 break-all text-red-600">→ {b.answer}</span>
        )}
      </span>
    );
  }

  const { inline, segments } = splitPassage(
    question.passage,
    question.blanks.length
  );

  const passageBody = inline ? (
    <p className="text-base sm:text-lg leading-loose break-words text-gray-900">
      {segments.map((seg, i) => (
        <Fragment key={i}>
          {seg}
          {i < question.blanks.length && renderBlank(question.blanks[i])}
        </Fragment>
      ))}
    </p>
  ) : (
    <>
      <p className="text-base sm:text-lg leading-relaxed break-words text-gray-900">
        {question.passage}
      </p>
      <ol className="mt-4 space-y-3">
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
  );

  const scorePanel = result && (
    <p className="font-semibold text-gray-900">
      Score: {result.score} / {result.total}
    </p>
  );

  const submitButton = !result && mode === "answer" && (
    <button
      className="w-full sm:w-auto bg-[#13395e] text-white px-6 py-2.5 rounded font-medium hover:bg-[#1b4d7e] active:bg-[#0f2e4c]"
      onClick={submit}
    >
      Submit
    </button>
  );

  if (!exam) {
    return (
      <div className="space-y-6">
        {passageBody}
        {submitButton}
        {scorePanel}
      </div>
    );
  }

  // ---- Exam shell ----
  const low = remaining <= 30 && !result;
  return (
    <div className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 bg-[#13395e] px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-blue-200">
            Reading
          </p>
          <h2 className="truncate text-sm font-semibold sm:text-base">
            Complete the Words
          </h2>
        </div>
        <div
          className={`flex items-center gap-1.5 rounded px-2.5 py-1 font-mono text-sm tabular-nums ${
            low ? "bg-red-600 text-white" : "bg-white/10 text-white"
          }`}
          aria-label="time remaining"
        >
          <span aria-hidden>⏱</span>
          <span>{formatClock(remaining)}</span>
        </div>
      </div>

      {/* Instruction */}
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
        <p className="text-sm text-gray-600">
          Complete the words by typing the missing letters. The dashes show how
          many letters are missing.
        </p>
      </div>

      {/* Reading panel */}
      <div className="px-4 py-5 sm:px-6 sm:py-6">{passageBody}</div>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
        <div className="text-sm text-gray-600">{scorePanel}</div>
        <div className="ml-auto">{submitButton}</div>
      </div>
    </div>
  );
}
