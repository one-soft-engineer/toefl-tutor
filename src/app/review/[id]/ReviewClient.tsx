"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CompleteTheWords } from "@/components/CompleteTheWords";
import type { Question } from "@/lib/types";
import type { GradeResult } from "@/lib/grade";

export function ReviewClient({
  question,
  questionId,
}: {
  question: Question;
  questionId: string;
}) {
  const router = useRouter();
  const [toast, setToast] = useState<{ amount: number; leveledUp: boolean } | null>(
    null
  );

  // Timed re-do: same TOEFL exam shell + countdown as practice. Grading is done
  // in the browser; on completion we award XP (capped once per question per day)
  // and refresh the server StatusBar. The card content itself is never written back.
  async function onGraded(result: GradeResult) {
    try {
      const res = await fetch("/api/questions/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, score: result.score }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        xp?: { awarded: number; leveledUp: boolean };
      };
      if (data.xp && data.xp.awarded > 0) {
        setToast({ amount: data.xp.awarded, leveledUp: data.xp.leveledUp });
        router.refresh();
        setTimeout(() => setToast(null), 1600);
      }
    } catch {
      // Network failure: the re-do still shows its score; XP just won't persist.
    }
  }

  return (
    <>
      {toast && (
        <div
          className="pointer-events-none fixed left-1/2 top-20 z-30 -translate-x-1/2"
          aria-live="polite"
        >
          <div className="animate-[fadeUp_1.6s_ease-out] rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-fg shadow-lg">
            +{toast.amount} XP{toast.leveledUp ? " · Level up! 🎉" : ""}
          </div>
        </div>
      )}
      <CompleteTheWords
        question={question}
        mode="answer"
        exam
        backHref="/review"
        onGraded={onGraded}
      />
    </>
  );
}
