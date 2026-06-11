import { describe, it, expect } from "vitest";
import { formatClock } from "@/lib/time";

describe("formatClock", () => {
  it("formats minutes and zero-padded seconds", () => {
    expect(formatClock(180)).toBe("3:00");
    expect(formatClock(5)).toBe("0:05");
    expect(formatClock(605)).toBe("10:05");
  });

  it("clamps negative values to 0:00", () => {
    expect(formatClock(-3)).toBe("0:00");
  });
});
