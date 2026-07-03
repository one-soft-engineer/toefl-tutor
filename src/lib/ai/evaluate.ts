import { z } from "zod";
import type { EvaluateInput, Feedback, SentenceEvaluator } from "./types";

export const inputSchema = z.object({
  word: z.string().min(1),
  meaning: z.string().optional(),
  sentence: z.string().min(1).max(500),
});

export const feedbackSchema = z.object({
  ok: z.boolean(),
  rewrite: z.string().min(1),
  tip: z.string().min(1),
});

export function buildPrompt(input: EvaluateInput): string {
  const meaning = input.meaning ? ` (meaning: ${input.meaning})` : "";
  return [
    "You are a concise TOEFL writing tutor.",
    `A learner is practising using the word "${input.word}"${meaning}.`,
    `Their sentence: "${input.sentence}"`,
    "",
    `Judge ONLY whether "${input.word}" is used correctly and naturally.`,
    'Respond with JSON: { "ok": boolean, "rewrite": string, "tip": string }',
    "- ok: true if the target word is used correctly and naturally, else false.",
    "- rewrite: a natural, corrected one-sentence version that keeps their meaning.",
    "- tip: ONE short, concrete note on collocation, register, or grammar. Under 20 words.",
  ].join("\n");
}

export function parseFeedback(raw: unknown): Feedback {
  let value: unknown;
  try {
    value = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error(`parseFeedback: invalid JSON from model — ${String(raw).slice(0, 80)}`);
  }
  return feedbackSchema.parse(value);
}

export type EvalResult =
  | { status: 200; feedback: Feedback }
  | { status: 400 | 502; error: string };

export async function runEvaluation(
  evaluator: SentenceEvaluator,
  rawBody: unknown
): Promise<EvalResult> {
  const parsed = inputSchema.safeParse(rawBody);
  if (!parsed.success) return { status: 400, error: "invalid payload" };
  try {
    const feedback = await evaluator.evaluate(parsed.data);
    return { status: 200, feedback };
  } catch {
    return { status: 502, error: "evaluation unavailable" };
  }
}
