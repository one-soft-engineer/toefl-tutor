import type { Blank } from "./types";

// Replace each "{}" sentinel in the passage with the corresponding blank's
// answer, in order. Used to build a fallback example sentence for a word when
// the blank has no explicit `example`.
export function fillPassage(passage: string, blanks: Blank[]): string {
  let i = 0;
  return passage.replace(/\{\}/g, () => blanks[i++]?.answer ?? "");
}
