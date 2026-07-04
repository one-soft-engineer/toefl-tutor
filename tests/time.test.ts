import { describe, it, expect } from "vitest";
import {
  formatClock,
  taipeiDate,
  taipeiYesterday,
  taipeiDayBeforeYesterday,
  taipeiWeekKey,
} from "@/lib/time";

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

describe("taipeiDate", () => {
  it("shifts UTC to UTC+8 before taking the calendar date", () => {
    // 2026-07-04T20:00Z is 2026-07-05 04:00 in Taipei
    expect(taipeiDate(new Date("2026-07-04T20:00:00Z"))).toBe("2026-07-05");
    // 2026-07-04T15:59Z is 2026-07-04 23:59 in Taipei (still the 4th)
    expect(taipeiDate(new Date("2026-07-04T15:59:00Z"))).toBe("2026-07-04");
  });
});

describe("taipeiYesterday", () => {
  it("is the Taipei calendar date 24h earlier", () => {
    expect(taipeiYesterday(new Date("2026-07-05T04:00:00+08:00"))).toBe("2026-07-04");
  });
});

describe("taipeiDayBeforeYesterday", () => {
  it("is the Taipei calendar date 48h earlier", () => {
    expect(taipeiDayBeforeYesterday(new Date("2026-07-05T04:00:00+08:00"))).toBe("2026-07-03");
  });
});

describe("taipeiWeekKey", () => {
  it("is stable within a 7-day bucket and ordered across buckets", () => {
    const a = taipeiWeekKey(new Date("2026-07-04T12:00:00Z"));
    const b = taipeiWeekKey(new Date("2026-07-06T12:00:00Z"));
    const later = taipeiWeekKey(new Date("2026-07-20T12:00:00Z"));
    expect(a).toBe(b); // same week bucket -> equal key
    expect(Number(later)).toBeGreaterThan(Number(a)); // a later week -> greater key
  });
});
