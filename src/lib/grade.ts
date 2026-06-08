import type { Question, BlankAnswer } from "./types";

export interface GradeResult {
  score: number; // number of correct blanks
  total: number;
  answers: BlankAnswer[];
}

// typedByIndex: map of blank index -> letters the user typed (missing part)
export function gradeAttempt(
  question: Question,
  typedByIndex: Record<number, string>
): GradeResult {
  const answers: BlankAnswer[] = question.blanks.map((b) => {
    const typed = (typedByIndex[b.index] ?? "").trim();
    const full = (b.shown + typed).toLowerCase();
    const correct = full === b.answer.trim().toLowerCase();
    return { index: b.index, typed, correct };
  });
  const score = answers.filter((a) => a.correct).length;
  return { score, total: question.blanks.length, answers };
}
