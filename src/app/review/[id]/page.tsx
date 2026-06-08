import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { questions } from "@/db/schema";
import type { Question } from "@/lib/types";
import { ReviewClient } from "./ReviewClient";

export const dynamic = "force-dynamic";

export default async function ReviewOne({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const row = (
    await db.select().from(questions).where(eq(questions.id, id)).limit(1)
  )[0];
  if (!row) notFound();

  const question: Question = {
    topic: row.topic,
    source: row.source,
    passage: row.passage,
    blanks: row.blanks,
  };

  return (
    <main className="max-w-2xl mx-auto p-8">
      <ReviewClient question={question} />
    </main>
  );
}
