import { NextResponse } from "next/server";
import { getEvaluator } from "@/lib/ai/provider";
import { runEvaluation } from "@/lib/ai/evaluate";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  let evaluator;
  try {
    evaluator = getEvaluator();
  } catch {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const result = await runEvaluation(evaluator, body);
  if (result.status === 200) return NextResponse.json(result.feedback);
  return NextResponse.json({ error: result.error }, { status: result.status });
}
