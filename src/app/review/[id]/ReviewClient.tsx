"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CompleteTheWords } from "@/components/CompleteTheWords";
import { XpToast, type XpToastData } from "@/components/XpToast";
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
  const [toast, setToast] = useState<XpToastData | null>(null);

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
        xp?: XpToastData & { awarded: number };
      };
      if (data.xp && data.xp.awarded > 0) {
        setToast(data.xp);
        router.refresh();
        setTimeout(() => setToast(null), 1800);
      }
    } catch {
      // Network failure: the re-do still shows its score; XP just won't persist.
    }
  }

  return (
    <>
      {toast && <XpToast data={toast} />}
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
