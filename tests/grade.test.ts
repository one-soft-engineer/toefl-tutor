import { describe, it, expect } from "vitest";
import { gradeAttempt } from "@/lib/grade";
import type { Question } from "@/lib/types";

const q: Question = {
  topic: "t",
  source: "s",
  passage: "p",
  blanks: [
    { index: 0, shown: "di", answer: "diverse" },
    { index: 1, shown: "prov", answer: "provide" },
  ],
};

describe("gradeAttempt", () => {
  it("marks all correct when typed completes the word", () => {
    const r = gradeAttempt(q, { 0: "verse", 1: "ide" });
    expect(r.score).toBe(2);
    expect(r.answers.every((a) => a.correct)).toBe(true);
  });

  it("is case-insensitive and trims whitespace", () => {
    const r = gradeAttempt(q, { 0: " VERSE ", 1: "IDE" });
    expect(r.score).toBe(2);
  });

  it("marks wrong typed letters incorrect", () => {
    const r = gradeAttempt(q, { 0: "ferent", 1: "ide" });
    expect(r.score).toBe(1);
    expect(r.answers[0].correct).toBe(false);
    expect(r.answers[1].correct).toBe(true);
  });

  it("treats a missing answer as incorrect", () => {
    const r = gradeAttempt(q, { 0: "verse" });
    expect(r.score).toBe(1);
    expect(r.answers[1].correct).toBe(false);
  });
});
