import { describe, it, expect } from "vitest";
import { dueDeck, type DeckCard } from "@/lib/flashcards";

const now = new Date("2026-06-14T12:00:00Z");
const past = new Date("2026-06-10T00:00:00Z");
const future = new Date("2026-06-20T00:00:00Z");

function card(p: Partial<DeckCard> & { word: string }): DeckCard {
  return {
    hint: undefined,
    example: "",
    topic: "T",
    box: 1,
    dueAt: past,
    isWrong: false,
    ...p,
  };
}

describe("dueDeck", () => {
  it("drops cards not yet due", () => {
    const deck = dueDeck(
      [card({ word: "due" }), card({ word: "later", dueAt: future })],
      now
    );
    expect(deck.map((c) => c.word)).toEqual(["due"]);
  });

  it("orders wrong words first, then by box, then word", () => {
    const deck = dueDeck(
      [
        card({ word: "beta", box: 3 }),
        card({ word: "alpha", box: 3 }),
        card({ word: "wrongone", isWrong: true, box: 4 }),
        card({ word: "low", box: 1 }),
      ],
      now
    );
    expect(deck.map((c) => c.word)).toEqual(["wrongone", "low", "alpha", "beta"]);
  });
});
