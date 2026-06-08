import { describe, it, expect } from "vitest";
import { parseQuestionFile } from "@/lib/question-schema";

const valid = {
  topic: "Marine Biology",
  source: "2026-06-08-batch1",
  passage: "Coral reefs are di_____ and prov___ shelter for spec___.",
  blanks: [
    { index: 0, shown: "di", answer: "diverse", hint: "varied" },
    { index: 1, shown: "prov", answer: "provide" },
    { index: 2, shown: "spec", answer: "species" },
  ],
};

describe("parseQuestionFile", () => {
  it("accepts a valid question", () => {
    const q = parseQuestionFile(valid);
    expect(q.topic).toBe("Marine Biology");
    expect(q.blanks).toHaveLength(3);
  });

  it("rejects a blank missing an answer", () => {
    const bad = { ...valid, blanks: [{ index: 0, shown: "di" }] };
    expect(() => parseQuestionFile(bad)).toThrow();
  });

  it("rejects an answer that does not start with shown letters", () => {
    const bad = {
      ...valid,
      blanks: [{ index: 0, shown: "xy", answer: "diverse" }],
    };
    expect(() => parseQuestionFile(bad)).toThrow(/shown/i);
  });
});
