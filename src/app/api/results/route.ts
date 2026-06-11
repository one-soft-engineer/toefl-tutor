import { NextResponse } from "next/server";
import { z } from "zod";
import { questionSchema } from "@/lib/question-schema";
import { ingestResult } from "@/lib/ingest";
import { drizzleIngestDeps } from "@/db/ingest-deps";

// Access control: locally the middleware passes through (LOCAL_MODE); in the
// cloud the middleware's GitHub OAuth gate protects this route. The practice
// page posts here same-origin to persist a graded attempt.
const payloadSchema = z.object({
  question: questionSchema,
  answers: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      typed: z.string(),
      correct: z.boolean(),
    })
  ),
  score: z.number().int().nonnegative(),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = payloadSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  await ingestResult(drizzleIngestDeps, parsed);
  return NextResponse.json({ ok: true });
}
