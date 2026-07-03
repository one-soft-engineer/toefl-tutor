import { describe, it, expect, afterEach } from "vitest";
import { getEvaluator } from "@/lib/ai/provider";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("getEvaluator", () => {
  it("throws when GEMINI_API_KEY is missing", () => {
    delete process.env.AI_PROVIDER;
    delete process.env.GEMINI_API_KEY;
    expect(() => getEvaluator()).toThrow(/GEMINI_API_KEY/);
  });

  it("returns an evaluator when configured", () => {
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    const e = getEvaluator();
    expect(typeof e.evaluate).toBe("function");
  });

  it("throws on an unknown provider", () => {
    process.env.AI_PROVIDER = "nope";
    expect(() => getEvaluator()).toThrow(/unknown AI_PROVIDER/);
  });
});
