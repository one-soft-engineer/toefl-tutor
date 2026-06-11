import { describe, it, expect } from "vitest";
import { classifyWords } from "@/lib/words";

const bank = [
  { word: "diverse", topic: "Bio", passage: "P1" },
  { word: "provide", topic: "Bio", passage: "P1" },
  { word: "magma", topic: "Geo", passage: "P2" },
  { word: "lava", topic: "Geo", passage: "P2" },
];

describe("classifyWords", () => {
  it("marks wrong, correct, and unpracticed words", () => {
    // P1 practiced, P2 not practiced. "provide" was wrong (x2).
    const rows = classifyWords(
      bank,
      new Set(["P1"]),
      new Map([["provide", 2]])
    );
    const byWord = Object.fromEntries(rows.map((r) => [r.word, r]));
    expect(byWord["provide"].status).toBe("wrong");
    expect(byWord["provide"].wrongCount).toBe(2);
    expect(byWord["diverse"].status).toBe("correct");
    expect(byWord["magma"].status).toBe("unpracticed");
    expect(byWord["lava"].status).toBe("unpracticed");
  });

  it("dedupes a word that appears in multiple questions, wrong wins", () => {
    const dupBank = [
      { word: "form", topic: "A", passage: "PA" },
      { word: "form", topic: "B", passage: "PB" },
    ];
    const rows = classifyWords(
      dupBank,
      new Set(["PA", "PB"]),
      new Map([["form", 1]])
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("wrong");
  });

  it("sorts wrong first (by count desc), then correct, then unpracticed", () => {
    const rows = classifyWords(
      bank,
      new Set(["P1"]),
      new Map([["provide", 2]])
    );
    expect(rows[0].word).toBe("provide"); // wrong first
    expect(rows[rows.length - 1].status).toBe("unpracticed");
  });
});
