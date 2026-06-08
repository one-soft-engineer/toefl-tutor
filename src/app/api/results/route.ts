import { NextResponse } from "next/server";
import { z } from "zod";
import { getUploadToken } from "@/lib/env";
import { questionSchema } from "@/lib/question-schema";
import { ingestResult } from "@/lib/ingest";
import { drizzleIngestDeps } from "@/db/ingest-deps";

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
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${getUploadToken()}`;
  if (auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let parsed;
  try {
    parsed = payloadSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  await ingestResult(drizzleIngestDeps, parsed);
  return NextResponse.json({ ok: true });
}
