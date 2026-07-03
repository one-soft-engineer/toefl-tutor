import { describe, it, expect } from "vitest";
import {
  buildPrompt,
  parseFeedback,
  runEvaluation,
} from "@/lib/ai/evaluate";
import type { SentenceEvaluator, Feedback } from "@/lib/ai/types";

describe("buildPrompt", () => {
  it("includes the target word and the learner sentence", () => {
    const p = buildPrompt({ word: "gather", meaning: "come together", sentence: "Birds gather here." });
    expect(p).toContain("gather");
    expect(p).toContain("Birds gather here.");
    expect(p).toContain("come together");
  });
});

describe("parseFeedback", () => {
  it("accepts a valid JSON string", () => {
    const f = parseFeedback('{"ok":true,"rewrite":"Birds gather here.","tip":"Good collocation."}');
    expect(f).toEqual({ ok: true, rewrite: "Birds gather here.", tip: "Good collocation." });
  });

  it("accepts an already-parsed object", () => {
    const f = parseFeedback({ ok: false, rewrite: "x", tip: "y" });
    expect(f.ok).toBe(false);
  });

  it("throws on a malformed shape", () => {
    expect(() => parseFeedback('{"ok":"yes"}')).toThrow();
  });
});

describe("runEvaluation", () => {
  const okEvaluator: SentenceEvaluator = {
    async evaluate() {
      return { ok: true, rewrite: "r", tip: "t" } satisfies Feedback;
    },
  };

  it("returns feedback for a valid payload", async () => {
    const r = await runEvaluation(okEvaluator, { word: "gather", sentence: "Birds gather." });
    expect(r).toEqual({ status: 200, feedback: { ok: true, rewrite: "r", tip: "t" } });
  });

  it("rejects an invalid payload with 400", async () => {
    const r = await runEvaluation(okEvaluator, { word: "", sentence: "" });
    expect(r).toEqual({ status: 400, error: "invalid payload" });
  });

  it("maps evaluator failure to 502", async () => {
    const failing: SentenceEvaluator = {
      async evaluate() {
        throw new Error("boom");
      },
    };
    const r = await runEvaluation(failing, { word: "gather", sentence: "Birds gather." });
    expect(r).toEqual({ status: 502, error: "evaluation unavailable" });
  });
});
