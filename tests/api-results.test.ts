import { describe, it, expect } from "vitest";
import { ingestResult, type IngestDeps } from "@/lib/ingest";
import type { Question, BlankAnswer } from "@/lib/types";

const question: Question = {
  topic: "t",
  source: "2026-06-08-b1",
  passage: "di_____ prov___",
  blanks: [
    { index: 0, shown: "di", answer: "diverse" },
    { index: 1, shown: "prov", answer: "provide" },
  ],
};

const answers: BlankAnswer[] = [
  { index: 0, typed: "verse", correct: true },
  { index: 1, typed: "xyz", correct: false },
];

function makeFakeDeps() {
  const calls = {
    upsertQuestion: [] as Question[],
    insertAttempt: [] as { questionId: string; score: number }[],
    upsertWrongWord: [] as string[],
  };
  const deps: IngestDeps = {
    async upsertQuestion(q) {
      calls.upsertQuestion.push(q);
      return "q-id-1";
    },
    async insertAttempt(a) {
      calls.insertAttempt.push({ questionId: a.questionId, score: a.score });
    },
    async upsertWrongWord(word) {
      calls.upsertWrongWord.push(word);
    },
  };
  return { deps, calls };
}

describe("ingestResult", () => {
  it("upserts question, inserts attempt, records only wrong words", async () => {
    const { deps, calls } = makeFakeDeps();
    await ingestResult(deps, { question, answers, score: 1 });

    expect(calls.upsertQuestion).toHaveLength(1);
    expect(calls.insertAttempt).toEqual([{ questionId: "q-id-1", score: 1 }]);
    expect(calls.upsertWrongWord).toEqual(["provide"]); // only the incorrect blank's answer
  });
});
