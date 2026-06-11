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
    <main className="w-full max-w-3xl mx-auto p-3 sm:p-6">
      <PracticeClient question={question} />
    </main>
  );
}
