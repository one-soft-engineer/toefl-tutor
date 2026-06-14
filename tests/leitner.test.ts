import { describe, it, expect } from "vitest";
import { reviewCard, isMastered, MAX_BOX } from "@/lib/leitner";

describe("reviewCard", () => {
  it("promotes one box on 'got' with a longer interval", () => {
    expect(reviewCard(1, "got")).toEqual({ box: 2, intervalDays: 1 });
    expect(reviewCard(2, "got")).toEqual({ box: 3, intervalDays: 3 });
    expect(reviewCard(4, "got")).toEqual({ box: 5, intervalDays: 16 });
  });

  it("caps the box at MAX_BOX", () => {
    expect(reviewCard(MAX_BOX, "got")).toEqual({ box: MAX_BOX, intervalDays: 16 });
  });

  it("resets to box 1 due immediately on 'again'", () => {
    expect(reviewCard(4, "again")).toEqual({ box: 1, intervalDays: 0 });
  });
});

describe("isMastered", () => {
  it("is true only at the top box", () => {
    expect(isMastered(MAX_BOX)).toBe(true);
    expect(isMastered(MAX_BOX - 1)).toBe(false);
  });
});
