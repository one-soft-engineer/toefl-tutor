import { describe, it, expect } from "vitest";
import path from "path";
import { loadAllQuestions, loadQuestion } from "@/lib/load-questions";

const fixturesDir = path.join(process.cwd(), "tests", "fixtures", "questions");
const emptyDir = path.join(process.cwd(), "tests", "fixtures", "does-not-exist");

describe("loadAllQuestions", () => {
  it("loads valid questions and collects errors for bad files", async () => {
    const { questions, errors } = await loadAllQuestions(fixturesDir);
    expect(questions.map((q) => q.file)).toContain("good");
    expect(questions.find((q) => q.file === "good")?.question.blanks).toHaveLength(2);
    expect(errors.map((e) => e.file)).toContain("bad");
  });

  it("returns empty result when directory is missing", async () => {
    const { questions, errors } = await loadAllQuestions(emptyDir);
    expect(questions).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });
});

describe("loadQuestion", () => {
  it("returns the matching question by slug", async () => {
    const q = await loadQuestion("good", fixturesDir);
    expect(q?.topic).toBe("Marine Biology");
  });

  it("returns null for an unknown slug", async () => {
    const q = await loadQuestion("nope", fixturesDir);
    expect(q).toBeNull();
  });
});
