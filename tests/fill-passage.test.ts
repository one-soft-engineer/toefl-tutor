import { describe, it, expect } from "vitest";
import { fillPassage } from "@/lib/fill-passage";
import type { Blank } from "@/lib/types";

const blanks: Blank[] = [
  { index: 0, shown: "di", answer: "diverse" },
  { index: 1, shown: "prov", answer: "provide" },
];

describe("fillPassage", () => {
  it("replaces each {} with its answer in order", () => {
    expect(fillPassage("Reefs are {} and {} shelter.", blanks)).toBe(
      "Reefs are diverse and provide shelter."
    );
  });

  it("returns the passage unchanged when there are no sentinels", () => {
    expect(fillPassage("No blanks here.", blanks)).toBe("No blanks here.");
  });
});
