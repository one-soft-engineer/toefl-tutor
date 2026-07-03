import { createGeminiEvaluator } from "./gemini";
import type { SentenceEvaluator } from "./types";

export function getEvaluator(): SentenceEvaluator {
  const provider = process.env.AI_PROVIDER ?? "gemini";
  if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    return createGeminiEvaluator({ apiKey, model });
  }
  throw new Error(`unknown AI_PROVIDER: ${provider}`);
}
