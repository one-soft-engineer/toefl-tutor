import { buildPrompt, parseFeedback } from "./evaluate";
import type { EvaluateInput, Feedback, SentenceEvaluator } from "./types";

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

const responseSchema = {
  type: "OBJECT",
  properties: {
    ok: { type: "BOOLEAN" },
    rewrite: { type: "STRING" },
    tip: { type: "STRING" },
  },
  required: ["ok", "rewrite", "tip"],
} as const;

export function createGeminiEvaluator(config: GeminiConfig): SentenceEvaluator {
  return {
    async evaluate(input: EvaluateInput): Promise<Feedback> {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${config.model}` +
        `:generateContent?key=${config.apiKey}`;
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 15_000);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildPrompt(input) }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema,
              temperature: 0.3,
            },
          }),
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(`gemini ${res.status}`);
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text !== "string") throw new Error("gemini: no text in response");
        return parseFeedback(text);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
