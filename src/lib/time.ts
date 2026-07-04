// Format a number of seconds as "M:SS" (minutes are not zero-padded).
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Asia/Taipei is a fixed UTC+8 with no daylight saving, so we can bucket by a
// constant offset without a timezone library.
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function taipeiDate(d: Date): string {
  return new Date(d.getTime() + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);
}

export function taipeiYesterday(d: Date): string {
  return taipeiDate(new Date(d.getTime() - DAY_MS));
}

export function taipeiDayBeforeYesterday(d: Date): string {
  return taipeiDate(new Date(d.getTime() - 2 * DAY_MS));
}

// Opaque per-week key: which 7-day block the Taipei day falls in. Used only to
// detect week rollover for the streak-freeze refill, so exact ISO-week
// numbering does not matter — only stability within a week and ordering.
export function taipeiWeekKey(d: Date): string {
  const days = Math.floor((d.getTime() + TAIPEI_OFFSET_MS) / DAY_MS);
  return String(Math.floor(days / 7));
}
