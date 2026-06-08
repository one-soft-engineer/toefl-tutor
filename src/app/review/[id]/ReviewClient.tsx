"use client";

import { CompleteTheWords } from "@/components/CompleteTheWords";
import type { Question } from "@/lib/types";

export function ReviewClient({ question }: { question: Question }) {
  // Replay only: grade locally, no upload.
  return <CompleteTheWords question={question} mode="answer" />;
}
