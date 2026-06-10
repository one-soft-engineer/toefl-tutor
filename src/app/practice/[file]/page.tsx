import { notFound, redirect } from "next/navigation";
import { isLocalMode } from "@/lib/env";
import { loadQuestion } from "@/lib/load-questions";
import { PracticeClient } from "./PracticeClient";

export const dynamic = "force-dynamic";

export default async function PracticePage({
  params,
}: {
  params: Promise<{ file: string }>;
}) {
  if (!isLocalMode()) redirect("/review");
  const { file } = await params;
  const question = await loadQuestion(file);
  if (!question) notFound();

  return (
    <main className="max-w-2xl mx-auto p-4 sm:p-8">
      <PracticeClient question={question} />
    </main>
  );
}
