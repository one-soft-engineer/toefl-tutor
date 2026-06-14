"use client";

import { useState } from "react";
import { CompleteTheWords } from "@/components/CompleteTheWords";
import type { Question, BlankAnswer } from "@/lib/types";
import type { GradeResult } from "@/lib/grade";

type SyncState = "idle" | "syncing" | "ok" | "failed";

interface ResultsPayload {
  question: Question;
  answers: BlankAnswer[];
  score: number;
}

export function PracticeClient({ question }: { question: Question }) {
  const [sync, setSync] = useState<SyncState>("idle");
  const [lastPayload, setLastPayload] = useState<ResultsPayload | null>(null);

  async function upload(payload: ResultsPayload) {
    setSync("syncing");
    try {
      const res = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setSync("ok");
    } catch {
      setSync("failed");
      localStorage.setItem("pending-result", JSON.stringify(payload));
    }
  }

  function onGraded(result: GradeResult) {
    const payload: ResultsPayload = {
      question,
      answers: result.answers,
      score: result.score,
    };
    setLastPayload(payload);
    void upload(payload);
  }

  return (
    <div className="space-y-4">
      <CompleteTheWords
        question={question}
        mode="answer"
        exam
        backHref="/"
        onGraded={onGraded}
      />

      {sync === "syncing" && <p className="text-muted">Saving…</p>}
      {sync === "ok" && <p className="text-ok">Saved.</p>}
      {sync === "failed" && (
        <div className="space-x-2 text-bad">
          <span>Save failed (kept locally).</span>
          <button
            className="underline"
            onClick={() => lastPayload && upload(lastPayload)}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
