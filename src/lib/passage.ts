// Authoring convention: each blank in a passage is written as the sentinel
// "{}" in reading order, matching the ordered `blanks` array. The component
// renders the leading `shown` letters plus an input at each sentinel.

export function splitPassage(
  passage: string,
  blankCount: number
): { inline: boolean; segments: string[] } {
  const segments = passage.split("{}");
  return { inline: segments.length === blankCount + 1, segments };
}

// Number of letters the user must type for a blank (answer minus the shown
// prefix). Always at least 1 so a blank is never zero-width.
export function missingLength(shown: string, answer: string): number {
  return Math.max(answer.length - shown.length, 1);
}
