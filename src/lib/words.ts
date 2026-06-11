export type WordStatus = "wrong" | "correct" | "unpracticed";

export interface BankWord {
  word: string;
  topic: string;
  passage: string;
}

export interface WordRow {
  word: string;
  topic: string;
  status: WordStatus;
  wrongCount: number;
}

const STATUS_ORDER: Record<WordStatus, number> = {
  wrong: 0,
  correct: 1,
  unpracticed: 2,
};

// Classify every bank word as wrong / correct / unpracticed and aggregate
// duplicates (a word may appear across questions). Wrong takes priority, then
// practiced-correct, then unpracticed.
export function classifyWords(
  bank: BankWord[],
  practicedPassages: Set<string>,
  wrongCounts: Map<string, number>
): WordRow[] {
  const byWord = new Map<string, WordRow>();

  for (const b of bank) {
    const key = b.word.toLowerCase();
    const wrongCount = wrongCounts.get(b.word) ?? wrongCounts.get(key) ?? 0;
    const practiced = practicedPassages.has(b.passage);
    const status: WordStatus = wrongCount > 0
      ? "wrong"
      : practiced
        ? "correct"
        : "unpracticed";

    const existing = byWord.get(key);
    if (!existing || STATUS_ORDER[status] < STATUS_ORDER[existing.status]) {
      byWord.set(key, { word: b.word, topic: b.topic, status, wrongCount });
    }
  }

  return [...byWord.values()].sort((a, b) => {
    if (a.status !== b.status) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (a.status === "wrong" && a.wrongCount !== b.wrongCount) {
      return b.wrongCount - a.wrongCount;
    }
    return a.word.localeCompare(b.word);
  });
}
