"use client";

import { CompleteTheWords } from "@/components/CompleteTheWords";
import type { Question } from "@/lib/types";

export function ReviewClient({ question }: { question: Question }) {
  // Timed re-do: same TOEFL exam shell + countdown as practice, but graded
  // locally with no upload (the cloud site is review-only and never writes).
  return (
    <CompleteTheWords question={question} mode="answer" exam backHref="/review" />
  );
}
