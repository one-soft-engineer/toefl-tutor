import type { Question, BlankAnswer } from "./types";

export interface IngestPayload {
  question: Question;
  answers: BlankAnswer[];
  score: number;
}

export interface IngestDeps {
  upsertQuestion(q: Question): Promise<string>; // returns question id
  insertAttempt(a: {
    questionId: string;
    score: number;
    answers: BlankAnswer[];
  }): Promise<void>;
  upsertWrongWord(word: string, questionId: string): Promise<void>;
}

export async function ingestResult(
  deps: IngestDeps,
  payload: IngestPayload
): Promise<void> {
  const questionId = await deps.upsertQuestion(payload.question);
  await deps.insertAttempt({
    questionId,
    score: payload.score,
    answers: payload.answers,
  });

  for (const a of payload.answers) {
    if (a.correct) continue;
    const blank = payload.question.blanks.find((b) => b.index === a.index);
    if (blank) await deps.upsertWrongWord(blank.answer, questionId);
  }
}
