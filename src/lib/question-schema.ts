import { z } from "zod";
import type { Question } from "./types";

const blankSchema = z
  .object({
    index: z.number().int().nonnegative(),
    shown: z.string().min(1),
    answer: z.string().min(1),
    hint: z.string().optional(),
  })
  .refine((b) => b.answer.toLowerCase().startsWith(b.shown.toLowerCase()), {
    message: "answer must start with the shown letters",
    path: ["answer"],
  });

export const questionSchema = z.object({
  topic: z.string().min(1),
  source: z.string().min(1),
  passage: z.string().min(1),
  blanks: z.array(blankSchema).min(1),
});

export function parseQuestionFile(data: unknown): Question {
  return questionSchema.parse(data);
}
