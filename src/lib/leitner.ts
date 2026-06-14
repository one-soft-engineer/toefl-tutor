export const MAX_BOX = 5;

// Days until a card in each box is due again (index by box - 1).
// box 1 is due the same day; higher boxes wait longer.
const INTERVAL_DAYS = [0, 1, 3, 7, 16];

export type ReviewResult = "got" | "again";

// Given the current box and a self-graded result, return the next box and the
// number of days until the card is due again.
export function reviewCard(
  box: number,
  result: ReviewResult
): { box: number; intervalDays: number } {
  if (result === "again") {
    return { box: 1, intervalDays: INTERVAL_DAYS[0] };
  }
  const next = Math.min(box + 1, MAX_BOX);
  return { box: next, intervalDays: INTERVAL_DAYS[next - 1] };
}

export function isMastered(box: number): boolean {
  return box >= MAX_BOX;
}

export function dueDateFrom(now: Date, intervalDays: number): Date {
  return new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
}
