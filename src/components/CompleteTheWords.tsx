"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
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
  /** If set, a "Back to questions" link is shown after grading (exam mode). */
  backHref?: string;
  onGraded?: (result: GradeResult) => void;
}

export function CompleteTheWords({
  question,
  mode,
  showHints,
  exam = false,
  durationSeconds = 180,
  backHref,
  onGraded,
}: Props) {
  const [typed, setTyped] = useState<Record<number, string>>({});
  const [result, setResult] = useState<GradeResult | null>(null);
  const [remaining, setRemaining] = useState(durationSeconds);
  const [focused, setFocused] = useState<number | null>(null);
  const submittedRef = useRef(false);

  function submit() {
    // Guard against a double submit (e.g. timer reaching 0 and a click racing).
    if (submittedRef.current) return;
    submittedRef.current = true;
    const r = gradeAttempt(question, typed);
    setResult(r);
    onGraded?.(r);
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

  // A blank renders its shown prefix, then one underlined cell per missing
  // letter so the number of slots is always visible. A single transparent
  // input overlays the cells and captures typing.
  function renderBlank(b: Blank) {
    const missing = missingLength(b.shown, b.answer);
    const a = answerFor(b.index);
    const value = typed[b.index] ?? "";
    const cellColor = a
      ? a.correct
        ? "border-ok text-ok"
        : "border-bad text-bad"
      : "border-muted text-fg";
    // After grading, tint the whole word (shown prefix included) and wrap it in
    // a soft colored pill so correct/wrong stands out clearly in both light and
    // dark mode — colored text alone is too low-contrast on a dark surface.
    const prefixColor = a ? (a.correct ? "text-ok" : "text-bad") : "text-fg";
    const wrapTint = a
      ? a.correct
        ? "rounded-md bg-ok-soft px-1 py-0.5"
        : "rounded-md bg-bad-soft px-1 py-0.5"
      : "";
    return (
      <span
        className={`inline-flex items-baseline whitespace-nowrap align-baseline ${wrapTint}`}
      >
        <span className={`font-mono ${prefixColor}`}>{b.shown}</span>
        <span className="relative mx-0.5 inline-block align-baseline">
          <span className="inline-flex gap-1" aria-hidden>
            {Array.from({ length: missing }).map((_, i) => {
              const active = !result && focused === b.index && value.length === i;
              return (
                <span
                  key={i}
                  className={`inline-block w-[1.1ch] text-center font-mono leading-tight border-b-2 ${cellColor} ${
                    active ? "border-accent bg-accent-soft" : ""
                  }`}
                >
                  {value[i] ?? " "}
                </span>
              );
            })}
          </span>
          <input
            className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent opacity-0 outline-none"
            value={value}
            disabled={!!result}
            maxLength={missing}
            onChange={(e) =>
              setTyped((t) => ({ ...t, [b.index]: e.target.value }))
            }
            onFocus={() => setFocused(b.index)}
            onBlur={() => setFocused((f) => (f === b.index ? null : f))}
            aria-label={`blank ${b.index + 1}, ${missing} letters`}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </span>
        {a &&
          (a.correct ? (
            <span className="ml-1 text-ok" aria-label="correct">
              ✓
            </span>
          ) : (
            <span className="ml-1 break-all text-bad">→ {b.answer}</span>
          ))}
      </span>
    );
  }

  const { inline, segments } = splitPassage(
    question.passage,
    question.blanks.length
  );

  const passageBody = inline ? (
    <p className="text-base sm:text-lg leading-loose break-words text-fg">
      {segments.map((seg, i) => (
        <Fragment key={i}>
          {seg}
          {i < question.blanks.length && renderBlank(question.blanks[i])}
        </Fragment>
      ))}
    </p>
  ) : (
    <>
      <p className="text-base sm:text-lg leading-relaxed break-words text-fg">
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
              <span className="text-sm text-muted">({b.hint})</span>
            )}
          </li>
        ))}
      </ol>
    </>
  );

  const scorePanel = result && (
    <p className="font-semibold text-fg">
      Score: {result.score} / {result.total}
    </p>
  );

  const submitButton = !result && mode === "answer" && (
    <button
      className="w-full rounded-lg bg-accent px-6 py-2.5 font-medium text-accent-fg transition-colors hover:bg-accent-hover sm:w-auto"
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
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 bg-accent px-4 py-3 text-accent-fg">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-accent-fg/70">
            Reading
          </p>
          <h2 className="truncate text-sm font-semibold sm:text-base">
            Complete the Words
          </h2>
        </div>
        <div
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-sm tabular-nums ${
            low ? "bg-bad text-white" : "bg-white/15 text-accent-fg"
          }`}
          aria-label="time remaining"
        >
          <span aria-hidden>⏱</span>
          <span>{formatClock(remaining)}</span>
        </div>
      </div>

      {/* Instruction */}
      <div className="border-b border-border bg-surface-2 px-4 py-3 sm:px-6">
        <p className="text-sm text-muted">
          Complete the words by typing the missing letters. The underscores show
          how many letters are missing.
        </p>
      </div>

      {/* Reading panel */}
      <div className="px-4 py-5 sm:px-6 sm:py-6">{passageBody}</div>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-2 px-4 py-3 sm:px-6">
        <div className="text-sm text-muted">{scorePanel}</div>
        <div className="ml-auto">
          {submitButton}
          {result && backHref && (
            <Link
              href={backHref}
              className="font-medium text-accent hover:underline"
            >
              ← Back to questions
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
