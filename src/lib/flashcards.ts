export interface DeckCard {
  word: string;
  hint?: string;
  example: string; // resolved example sentence (own, or filled-passage fallback)
  topic: string;
  box: number;
  dueAt: Date;
  isWrong: boolean;
}

// Keep only cards that are due (dueAt <= now) and order them: wrong words
// first, then lower Leitner boxes, then earliest due, then alphabetical.
export function dueDeck(cards: DeckCard[], now: Date): DeckCard[] {
  return cards
    .filter((c) => c.dueAt.getTime() <= now.getTime())
    .sort((a, b) => {
      if (a.isWrong !== b.isWrong) return a.isWrong ? -1 : 1;
      if (a.box !== b.box) return a.box - b.box;
      if (a.dueAt.getTime() !== b.dueAt.getTime()) {
        return a.dueAt.getTime() - b.dueAt.getTime();
      }
      return a.word.localeCompare(b.word);
    });
}
