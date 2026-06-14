import { describe, it, expect } from "vitest";
import { exampleSentence } from "@/lib/fill-passage";
import type { Blank } from "@/lib/types";

const blanks: Blank[] = [
  { index: 0, shown: "co", answer: "coral" },
  { index: 1, shown: "di", answer: "diverse" },
  { index: 2, shown: "prov", answer: "provide" },
];
const passage = "Reefs are {}. They are {} and {} shelter for fish.";

describe("exampleSentence", () => {
  it("returns only the sentence containing the target blank, filled", () => {
    expect(exampleSentence(passage, blanks, 0)).toBe("Reefs are coral.");
    expect(exampleSentence(passage, blanks, 1)).toBe(
      "They are diverse and provide shelter for fish."
    );
    expect(exampleSentence(passage, blanks, 2)).toBe(
      "They are diverse and provide shelter for fish."
    );
  });

  it("falls back to the whole filled passage if no sentence is found", () => {
    expect(exampleSentence("just {} here", blanks, 0)).toBe("just coral here");
  });
});
