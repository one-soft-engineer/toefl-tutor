"use client";

import { useState } from "react";
import type { ReviewResult } from "@/lib/leitner";
import type { Feedback } from "@/lib/ai/types";
import type { StudyCard } from "./StudyClient";

export function ProductionCard({
  card,
  onGrade,
  busy,
}: {
  card: StudyCard;
  onGrade: (result: ReviewResult) => void;
  busy: boolean;
}) {
  const [sentence, setSentence] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function getFeedback() {
    if (!sentence.trim() || state === "loading") return;
    setState("loading");
    setFeedback(null);
    try {
      const res = await fetch("/api/flashcards/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: card.word, meaning: card.hint, sentence }),
      });
      if (!res.ok) throw new Error();
      setFeedback((await res.json()) as Feedback);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  const revealed = feedback !== null || state === "error";

  return (
    <div className="flex min-h-[16rem] flex-col rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-muted">
          {card.topic}
        </span>
        <span className="ml-auto text-muted">box {card.box}</span>
      </div>

      <div className="mt-4 space-y-1 text-center">
        <p className="font-mono text-2xl font-bold text-accent">{card.word}</p>
        <p className="text-sm text-muted">{card.hint ?? "Use this word in a sentence."}</p>
      </div>

      <label className="mt-4 block text-xs uppercase tracking-wide text-muted">
        Write a sentence using this word
      </label>
      <textarea
        className="mt-1 w-full rounded-lg border border-border bg-surface-2 p-3 text-fg outline-none focus:border-accent"
        rows={3}
        value={sentence}
        disabled={state === "loading"}
        onChange={(e) => setSentence(e.target.value)}
        placeholder={`e.g. a sentence with "${card.word}"`}
      />

      {!revealed && (
        <button
          className="mt-3 w-full rounded-lg bg-accent px-4 py-3 font-medium text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-50"
          disabled={!sentence.trim() || state === "loading"}
          onClick={getFeedback}
        >
          {state === "loading" ? "Checking…" : "Get feedback"}
        </button>
      )}

      {feedback && (
        <div className="mt-4 space-y-2 rounded-lg border border-border bg-surface-2 p-3 text-sm">
          <p className={feedback.ok ? "font-medium text-ok" : "font-medium text-bad"}>
            {feedback.ok ? "✅ Correct and natural" : "⚠️ Needs work"}
          </p>
          <p className="text-fg">
            <span className="text-muted">Rewrite: </span>
            {feedback.rewrite}
          </p>
          <p className="text-fg">
            <span className="text-muted">Tip: </span>
            {feedback.tip}
          </p>
          <p className="text-fg">
            <span className="text-muted">Example: </span>
            {card.example}
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3 text-sm text-muted">
          AI feedback unavailable — compare with the example and self-grade.
          <p className="mt-1 text-fg">
            <span className="text-muted">Example: </span>
            {card.example}
          </p>
        </div>
      )}

      {revealed && (
        <div className="mt-4 flex gap-3">
          <button
            disabled={busy}
            className="flex-1 rounded-lg border-2 border-bad/40 bg-bad-soft px-4 py-3 font-medium text-bad transition-colors hover:border-bad disabled:opacity-50"
            onClick={() => onGrade("again")}
          >
            Again
          </button>
          <button
            disabled={busy}
            className="flex-1 rounded-lg border-2 border-ok/40 bg-ok-soft px-4 py-3 font-medium text-ok transition-colors hover:border-ok disabled:opacity-50"
            onClick={() => onGrade("got")}
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
