/**
 * Register a question JSON file into the local SQLite database (local.db)
 * WITHOUT taking a practice attempt.
 *
 * Questions normally only enter the DB when you practise them (POST /api/results).
 * The daily auto-author flow has no human in the loop, so this inserts the
 * `questions` row directly via the same upsert the app uses (deduped by passage).
 *
 * Usage:
 *   pnpm db:add <slug>     # e.g. pnpm db:add 2026-06-17-volcanoes
 *   pnpm db:add            # no slug -> the newest questions/*.json file
 */
import { promises as fs } from "fs";
import path from "path";
import { loadQuestion, loadAllQuestions } from "../src/lib/load-questions";
import { drizzleIngestDeps } from "../src/db/ingest-deps";

const QUESTIONS_DIR = path.join(process.cwd(), "questions");

async function newestSlug(): Promise<string | null> {
  let files: string[];
  try {
    files = (await fs.readdir(QUESTIONS_DIR)).filter((f) => f.endsWith(".json"));
  } catch {
    return null;
  }
  if (files.length === 0) return null;
  const withTime = await Promise.all(
    files.map(async (f) => ({
      slug: f.replace(/\.json$/, ""),
      mtime: (await fs.stat(path.join(QUESTIONS_DIR, f))).mtimeMs,
    }))
  );
  withTime.sort((a, b) => b.mtime - a.mtime);
  return withTime[0].slug;
}

async function main() {
  const arg = process.argv[2];
  const slug = arg ?? (await newestSlug());
  if (!slug) {
    console.error("error: no question file found in questions/");
    process.exit(1);
  }

  const question = await loadQuestion(slug);
  if (!question) {
    // Surface validation errors if the file exists but is malformed.
    const { errors } = await loadAllQuestions();
    const err = errors.find((e) => e.file === slug);
    console.error(
      err
        ? `error: ${slug}.json failed validation: ${err.error}`
        : `error: question "${slug}" not found in questions/`
    );
    process.exit(1);
  }

  // Invariant the zod schema doesn't cover: one {} sentinel per blank, in order.
  const sentinels = question.passage.split("{}").length - 1;
  if (sentinels !== question.blanks.length) {
    console.error(
      `error: ${slug}.json has ${sentinels} "{}" sentinel(s) but ${question.blanks.length} blank(s) — they must match`
    );
    process.exit(1);
  }

  const id = await drizzleIngestDeps.upsertQuestion(question);
  console.log(`Registered "${slug}" (${question.topic}) -> question id ${id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
