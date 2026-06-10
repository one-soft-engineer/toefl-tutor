import { desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { wrongWords } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function WrongWordsPage() {
  const db = getDb();
  const rows = await db
    .select()
    .from(wrongWords)
    .orderBy(desc(wrongWords.wrongCount));

  return (
    <main className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6">
      <h1 className="text-2xl font-bold">Wrong Words</h1>
      <div className="-mx-4 sm:mx-0 overflow-x-auto">
        <table className="w-full min-w-[20rem] text-left">
          <thead>
            <tr className="border-b">
              <th className="px-4 sm:px-0 py-2">Word</th>
              <th className="px-2 py-2 whitespace-nowrap">Times wrong</th>
              <th className="px-4 sm:px-0 py-2 whitespace-nowrap">Last wrong</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id} className="border-b">
                <td className="px-4 sm:px-0 py-2 font-mono break-all">
                  {w.word}
                </td>
                <td className="px-2 py-2 text-center">{w.wrongCount}</td>
                <td className="px-4 sm:px-0 py-2 whitespace-nowrap">
                  {new Date(w.lastWrongAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="text-gray-500">No wrong words yet.</p>}
    </main>
  );
}
