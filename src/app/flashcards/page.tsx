import { getDb } from "@/db/client";
import { questions, cardProgress, wrongWords } from "@/db/schema";
import { isLocalMode } from "@/lib/env";
import { loadAllQuestions } from "@/lib/load-questions";
import { exampleSentence } from "@/lib/fill-passage";
import { dueDeck, type DeckCard } from "@/lib/flashcards";
import type { Blank } from "@/lib/types";
import { StudyClient, type StudyCard } from "./StudyClient";

export const dynamic = "force-dynamic";

interface Source {
  topic: string;
  passage: string;
  blanks: Blank[];
  blank: Blank;
}

async function gatherSources(): Promise<Map<string, Source>> {
  const byWord = new Map<string, Source>();
  const add = (topic: string, passage: string, blanks: Blank[]) => {
    for (const blank of blanks) {
      const existing = byWord.get(blank.answer);
      // Prefer a source whose blank has an explicit example, then a hint.
      const better =
        !existing ||
        (!existing.blank.example && blank.example) ||
        (!existing.blank.hint && !existing.blank.example && blank.hint);
      if (better) byWord.set(blank.answer, { topic, passage, blanks, blank });
    }
  };

  if (isLocalMode()) {
    const { questions: loaded } = await loadAllQuestions();
    for (const q of loaded) add(q.question.topic, q.question.passage, q.question.blanks);
  } else {
    const db = getDb();
    const rows = await db
      .select({ topic: questions.topic, passage: questions.passage, blanks: questions.blanks })
      .from(questions);
    for (const r of rows) add(r.topic, r.passage, r.blanks);
  }
  return byWord;
}

export default async function FlashcardsPage() {
  const db = getDb();
  const [sources, progressRows, wrongRows] = await Promise.all([
    gatherSources(),
    db.select().from(cardProgress),
    db.select({ word: wrongWords.word }).from(wrongWords),
  ]);

  const now = new Date();
  const progress = new Map(progressRows.map((p) => [p.word, p]));
  const wrong = new Set(wrongRows.map((w) => w.word));

  const cards: DeckCard[] = [...sources.entries()].map(([word, s]) => {
    const p = progress.get(word);
    return {
      word,
      hint: s.blank.hint,
      example: s.blank.example ?? exampleSentence(s.passage, s.blanks, s.blank.index),
      topic: s.topic,
      box: p?.box ?? 1,
      dueAt: p?.dueAt ?? now, // never-studied words are due now
      isWrong: wrong.has(word),
    };
  });

  const deck = dueDeck(cards, now);
  const studyCards: StudyCard[] = deck.map((c) => ({
    word: c.word,
    hint: c.hint,
    example: c.example,
    topic: c.topic,
    box: c.box,
    isWrong: c.isWrong,
  }));

  const backHref = isLocalMode() ? "/" : "/review";

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 sm:py-10">
      <StudyClient deck={studyCards} backHref={backHref} />
    </main>
  );
}
