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
    <main className="max-w-2xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold">Wrong Words</h1>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b">
            <th className="py-2">Word</th>
            <th className="py-2">Times wrong</th>
            <th className="py-2">Last wrong</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w) => (
            <tr key={w.id} className="border-b">
              <td className="py-2 font-mono">{w.word}</td>
              <td className="py-2">{w.wrongCount}</td>
              <td className="py-2">
                {new Date(w.lastWrongAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="text-gray-500">No wrong words yet.</p>
      )}
    </main>
  );
}
