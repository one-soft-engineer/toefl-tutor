import { describe, it, expect } from "vitest";
import path from "path";
import { loadQuestion } from "@/lib/load-questions";
import { gradeAttempt } from "@/lib/grade";

const questionsDir = path.join(process.cwd(), "questions");

// Contract test: the committed example question must satisfy the authoring
// format and flow cleanly through the loader and grader.
describe("example question contract", () => {
  it("loads and grades the committed example end-to-end", async () => {
    const q = await loadQuestion("2026-06-08-example", questionsDir);
    expect(q).not.toBeNull();
    expect(q!.blanks.length).toBeGreaterThan(0);

    // Typing the missing letters (answer minus shown) for every blank => all correct.
    const typed: Record<number, string> = {};
    for (const b of q!.blanks) {
      typed[b.index] = b.answer.slice(b.shown.length);
    }
    const result = gradeAttempt(q!, typed);
    expect(result.score).toBe(q!.blanks.length);
  });
});
