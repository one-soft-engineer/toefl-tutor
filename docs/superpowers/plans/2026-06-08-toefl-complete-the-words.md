# TOEFL Complete-the-Words Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user Next.js app where Claude Code authors TOEFL "Complete the Words" questions as local JSON, the user practices locally with auto-grading, and results auto-sync to a Vercel-deployed practice site backed by Neon Postgres.

**Architecture:** One Next.js (App Router) repo. Local `next dev` (with `LOCAL_MODE=1`) reads `questions/*.json`, renders the quiz, grades locally, then POSTs results to the deployed `/api/results` (Bearer token). The deployed app stores data via Drizzle/Neon and serves review + wrong-words pages behind GitHub OAuth (allowlisted to one account).

**Tech Stack:** Next.js 15 (App Router, TypeScript), Drizzle ORM + `@neondatabase/serverless`, NextAuth v5 (Auth.js) GitHub provider, Zod, Vitest, Tailwind CSS.

---

## File Structure

```
toefl-tutor/
├── questions/                       # Claude Code writes JSON here (gitignored content optional)
│   └── 2026-06-08-example.json
├── src/
│   ├── lib/
│   │   ├── types.ts                 # Shared Question/Blank/Answer TS types
│   │   ├── question-schema.ts       # Zod schema + validate helper
│   │   ├── grade.ts                  # gradeAttempt pure function
│   │   ├── load-questions.ts        # Local: read & validate questions/*.json
│   │   └── env.ts                    # Env var access helpers
│   ├── db/
│   │   ├── schema.ts                 # Drizzle table definitions
│   │   └── client.ts                 # Neon + Drizzle client
│   ├── components/
│   │   └── CompleteTheWords.tsx      # Shared quiz renderer
│   ├── app/
│   │   ├── page.tsx                  # Local question list (LOCAL_MODE)
│   │   ├── practice/[file]/page.tsx  # Local practice page
│   │   ├── review/page.tsx           # Cloud: review list
│   │   ├── review/[id]/page.tsx      # Cloud: replay one question
│   │   ├── wrong-words/page.tsx      # Cloud: wrong-words book
│   │   └── api/
│   │       ├── results/route.ts      # POST results (Bearer token)
│   │       └── auth/[...nextauth]/route.ts
│   └── auth.ts                        # NextAuth config + allowlist
├── tests/
│   ├── grade.test.ts
│   ├── question-schema.test.ts
│   └── api-results.test.ts
├── drizzle.config.ts
├── vitest.config.ts
└── .env.local.example
```

---

## Task 1: Scaffold Next.js project

**Files:**
- Create: project scaffold, `package.json`, `tsconfig.json`, `.gitignore`

- [ ] **Step 1: Scaffold Next.js app in current directory**

Run (the directory already contains `docs/` and `.git`, so scaffold into the existing dir):

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm
```

When prompted that the directory is not empty, choose to continue (it only contains `docs/` and git history).

- [ ] **Step 2: Verify dev server boots**

Run: `npm run dev` then visit `http://localhost:3000`
Expected: default Next.js page renders. Stop the server (Ctrl-C).

- [ ] **Step 3: Add gitignore entries for env and local question data**

Append to `.gitignore`:

```
# Local env
.env.local
# Local generated questions (kept out of git; synced to cloud DB instead)
/questions/*.json
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app"
```

---

## Task 2: Install dependencies and test tooling

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install runtime + dev dependencies**

```bash
npm install drizzle-orm @neondatabase/serverless next-auth@beta zod
npm install -D drizzle-kit vitest @vitejs/plugin-react vite-tsconfig-paths
```

- [ ] **Step 2: Create Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Add test script to package.json**

In `package.json` `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify Vitest runs (no tests yet)**

Run: `npm test`
Expected: exits 0 with "No test files found" (acceptable for now).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add drizzle, next-auth, zod, vitest"
```

---

## Task 3: Shared types and Zod question schema (TDD)

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/question-schema.ts`
- Test: `tests/question-schema.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/question-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseQuestionFile } from "@/lib/question-schema";

const valid = {
  topic: "Marine Biology",
  source: "2026-06-08-batch1",
  passage: "Coral reefs are di_____ and prov___ shelter for spec___.",
  blanks: [
    { index: 0, shown: "di", answer: "diverse", hint: "varied" },
    { index: 1, shown: "prov", answer: "provide" },
    { index: 2, shown: "spec", answer: "species" },
  ],
};

describe("parseQuestionFile", () => {
  it("accepts a valid question", () => {
    const q = parseQuestionFile(valid);
    expect(q.topic).toBe("Marine Biology");
    expect(q.blanks).toHaveLength(3);
  });

  it("rejects a blank missing an answer", () => {
    const bad = { ...valid, blanks: [{ index: 0, shown: "di" }] };
    expect(() => parseQuestionFile(bad)).toThrow();
  });

  it("rejects an answer that does not start with shown letters", () => {
    const bad = {
      ...valid,
      blanks: [{ index: 0, shown: "xy", answer: "diverse" }],
    };
    expect(() => parseQuestionFile(bad)).toThrow(/shown/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `@/lib/question-schema`.

- [ ] **Step 3: Write shared types**

Create `src/lib/types.ts`:

```ts
export interface Blank {
  index: number;
  shown: string;   // leading letters shown to the user
  answer: string;  // full correct word, American spelling
  hint?: string;
}

export interface Question {
  topic: string;
  source: string;
  passage: string;
  blanks: Blank[];
}

// One user-typed answer per blank, plus correctness after grading.
export interface BlankAnswer {
  index: number;
  typed: string;      // letters the user typed (the missing part)
  correct: boolean;
}
```

- [ ] **Step 4: Write the Zod schema + parser**

Create `src/lib/question-schema.ts`:

```ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: shared question types and zod schema"
```

---

## Task 4: Grading pure function (TDD)

**Files:**
- Create: `src/lib/grade.ts`
- Test: `tests/grade.test.ts`

The user types only the **missing** letters. The full word = `shown + typed`. Compare case-insensitively after trimming.

- [ ] **Step 1: Write the failing test**

Create `tests/grade.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { gradeAttempt } from "@/lib/grade";
import type { Question } from "@/lib/types";

const q: Question = {
  topic: "t",
  source: "s",
  passage: "p",
  blanks: [
    { index: 0, shown: "di", answer: "diverse" },
    { index: 1, shown: "prov", answer: "provide" },
  ],
};

describe("gradeAttempt", () => {
  it("marks all correct when typed completes the word", () => {
    const r = gradeAttempt(q, { 0: "verse", 1: "ide" });
    expect(r.score).toBe(2);
    expect(r.answers.every((a) => a.correct)).toBe(true);
  });

  it("is case-insensitive and trims whitespace", () => {
    const r = gradeAttempt(q, { 0: " VERSE ", 1: "IDE" });
    expect(r.score).toBe(2);
  });

  it("marks wrong typed letters incorrect", () => {
    const r = gradeAttempt(q, { 0: "ferent", 1: "ide" });
    expect(r.score).toBe(1);
    expect(r.answers[0].correct).toBe(false);
    expect(r.answers[1].correct).toBe(true);
  });

  it("treats a missing answer as incorrect", () => {
    const r = gradeAttempt(q, { 0: "verse" });
    expect(r.score).toBe(1);
    expect(r.answers[1].correct).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/grade.test.ts`
Expected: FAIL — cannot find module `@/lib/grade`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/grade.ts`:

```ts
import type { Question, BlankAnswer } from "./types";

export interface GradeResult {
  score: number;          // number of correct blanks
  total: number;
  answers: BlankAnswer[];
}

// typedByIndex: map of blank index -> letters the user typed (missing part)
export function gradeAttempt(
  question: Question,
  typedByIndex: Record<number, string>
): GradeResult {
  const answers: BlankAnswer[] = question.blanks.map((b) => {
    const typed = (typedByIndex[b.index] ?? "").trim();
    const full = (b.shown + typed).toLowerCase();
    const correct = full === b.answer.trim().toLowerCase();
    return { index: b.index, typed, correct };
  });
  const score = answers.filter((a) => a.correct).length;
  return { score, total: question.blanks.length, answers };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/grade.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: gradeAttempt grading function"
```

---

## Task 5: Drizzle schema and DB client

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/client.ts`
- Create: `drizzle.config.ts`
- Create: `.env.local.example`

- [ ] **Step 1: Write the Drizzle schema**

Create `src/db/schema.ts`:

```ts
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import type { Blank, BlankAnswer } from "@/lib/types";

export const questions = pgTable("questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  passage: text("passage").notNull(),
  blanks: jsonb("blanks").$type<Blank[]>().notNull(),
  topic: text("topic").notNull(),
  source: text("source").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const attempts = pgTable("attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  questionId: uuid("question_id")
    .references(() => questions.id)
    .notNull(),
  answers: jsonb("answers").$type<BlankAnswer[]>().notNull(),
  score: integer("score").notNull(),
  takenAt: timestamp("taken_at").defaultNow().notNull(),
});

export const wrongWords = pgTable("wrong_words", {
  id: uuid("id").defaultRandom().primaryKey(),
  word: text("word").notNull().unique(),
  wrongCount: integer("wrong_count").notNull().default(1),
  lastQuestionId: uuid("last_question_id").references(() => questions.id),
  lastWrongAt: timestamp("last_wrong_at").defaultNow().notNull(),
});
```

- [ ] **Step 2: Write the DB client**

Create `src/db/client.ts`:

```ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set");
}

export const db = drizzle(neon(url), { schema });
```

- [ ] **Step 3: Write drizzle-kit config**

Create `drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 4: Write example env file**

Create `.env.local.example`:

```
# Cloud (deployed) — required
DATABASE_URL=postgres://...neon...
UPLOAD_TOKEN=generate-a-long-random-string
GITHUB_ID=
GITHUB_SECRET=
ALLOWED_GITHUB_LOGIN=your-github-username
NEXTAUTH_SECRET=generate-a-long-random-string
NEXTAUTH_URL=http://localhost:3000

# Local authoring/practice — required only when running locally
LOCAL_MODE=1
RESULTS_ENDPOINT=https://your-app.vercel.app/api/results
```

- [ ] **Step 5: Add db push script**

In `package.json` `"scripts"`, add:

```json
"db:push": "drizzle-kit push"
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: drizzle schema, db client, env example"
```

---

## Task 6: Env helpers

**Files:**
- Create: `src/lib/env.ts`

- [ ] **Step 1: Write env helpers**

Create `src/lib/env.ts`:

```ts
export function isLocalMode(): boolean {
  return process.env.LOCAL_MODE === "1";
}

export function getUploadToken(): string {
  const t = process.env.UPLOAD_TOKEN;
  if (!t) throw new Error("UPLOAD_TOKEN is not set");
  return t;
}

export function getResultsEndpoint(): string {
  const e = process.env.RESULTS_ENDPOINT;
  if (!e) throw new Error("RESULTS_ENDPOINT is not set");
  return e;
}

export function getAllowedGithubLogin(): string {
  const l = process.env.ALLOWED_GITHUB_LOGIN;
  if (!l) throw new Error("ALLOWED_GITHUB_LOGIN is not set");
  return l;
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: env accessor helpers"
```

---

## Task 7: Local question loader

**Files:**
- Create: `src/lib/load-questions.ts`

Reads `questions/*.json`, validates each with Zod, returns list with filename keys. Bad files are reported, not thrown.

- [ ] **Step 1: Write the loader**

Create `src/lib/load-questions.ts`:

```ts
import { promises as fs } from "fs";
import path from "path";
import { parseQuestionFile } from "./question-schema";
import type { Question } from "./types";

export interface LoadedQuestion {
  file: string;       // filename without .json, used as route slug
  question: Question;
}

export interface LoadError {
  file: string;
  error: string;
}

const QUESTIONS_DIR = path.join(process.cwd(), "questions");

export async function loadAllQuestions(): Promise<{
  questions: LoadedQuestion[];
  errors: LoadError[];
}> {
  let files: string[];
  try {
    files = (await fs.readdir(QUESTIONS_DIR)).filter((f) => f.endsWith(".json"));
  } catch {
    return { questions: [], errors: [] };
  }

  const questions: LoadedQuestion[] = [];
  const errors: LoadError[] = [];

  for (const f of files) {
    const slug = f.replace(/\.json$/, "");
    try {
      const raw = await fs.readFile(path.join(QUESTIONS_DIR, f), "utf8");
      const parsed = parseQuestionFile(JSON.parse(raw));
      questions.push({ file: slug, question: parsed });
    } catch (e) {
      errors.push({ file: slug, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { questions, errors };
}

export async function loadQuestion(slug: string): Promise<Question | null> {
  const { questions } = await loadAllQuestions();
  return questions.find((q) => q.file === slug)?.question ?? null;
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: local questions loader with validation"
```

---

## Task 8: CompleteTheWords component

**Files:**
- Create: `src/components/CompleteTheWords.tsx`

Renders the passage with inline inputs. The passage uses the convention: each blank appears as `shown` followed by underscores (e.g. `di_____`). The component splits the passage by blank tokens in order and renders an input after each `shown` prefix.

To keep parsing simple and robust, the component does **not** parse the passage text for blanks. Instead it renders the passage as plain text and renders a separate ordered list of blank inputs below it, each labeled with its `shown` prefix. This avoids fragile inline-token parsing.

- [ ] **Step 1: Write the component**

Create `src/components/CompleteTheWords.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { Question, BlankAnswer } from "@/lib/types";
import { gradeAttempt, type GradeResult } from "@/lib/grade";

interface Props {
  question: Question;
  mode: "answer" | "review";
  showHints?: boolean;
  onGraded?: (result: GradeResult) => void;
}

export function CompleteTheWords({ question, mode, showHints, onGraded }: Props) {
  const [typed, setTyped] = useState<Record<number, string>>({});
  const [result, setResult] = useState<GradeResult | null>(null);

  function submit() {
    const r = gradeAttempt(question, typed);
    setResult(r);
    onGraded?.(r);
  }

  function answerFor(index: number): BlankAnswer | undefined {
    return result?.answers.find((a) => a.index === index);
  }

  return (
    <div className="space-y-6">
      <p className="text-lg leading-relaxed">{question.passage}</p>

      <ol className="space-y-3">
        {question.blanks.map((b) => {
          const a = answerFor(b.index);
          return (
            <li key={b.index} className="flex items-center gap-2">
              <span className="font-mono">{b.shown}</span>
              <input
                className="border rounded px-2 py-1 font-mono"
                value={typed[b.index] ?? ""}
                disabled={!!result}
                onChange={(e) =>
                  setTyped((t) => ({ ...t, [b.index]: e.target.value }))
                }
                placeholder="missing letters"
              />
              {showHints && b.hint && (
                <span className="text-sm text-gray-500">({b.hint})</span>
              )}
              {a && (
                <span className={a.correct ? "text-green-600" : "text-red-600"}>
                  {a.correct ? "✓" : `✗ ${b.answer}`}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {!result && mode === "answer" && (
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={submit}
        >
          Submit
        </button>
      )}

      {result && (
        <p className="font-semibold">
          Score: {result.score} / {result.total}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: CompleteTheWords quiz component"
```

---

## Task 9: Local question list page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace the default home page**

Replace `src/app/page.tsx` with:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { isLocalMode } from "@/lib/env";
import { loadAllQuestions } from "@/lib/load-questions";

export default async function Home() {
  if (!isLocalMode()) {
    redirect("/review");
  }

  const { questions, errors } = await loadAllQuestions();

  return (
    <main className="max-w-2xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold">Local Question Bank</h1>

      {questions.length === 0 && errors.length === 0 && (
        <p className="text-gray-500">
          No questions yet. Ask Claude Code to generate some into{" "}
          <code>questions/</code>.
        </p>
      )}

      <ul className="space-y-2">
        {questions.map((q) => (
          <li key={q.file}>
            <Link className="text-blue-600 underline" href={`/practice/${q.file}`}>
              {q.question.topic} — {q.file}
            </Link>
          </li>
        ))}
      </ul>

      {errors.length > 0 && (
        <div>
          <h2 className="text-red-600 font-semibold">Invalid files</h2>
          <ul className="space-y-1">
            {errors.map((e) => (
              <li key={e.file} className="text-red-600 text-sm">
                {e.file}: {e.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: local question list page"
```

---

## Task 10: Local practice page with auto-upload

**Files:**
- Create: `src/app/practice/[file]/page.tsx`
- Create: `src/app/practice/[file]/PracticeClient.tsx`

The server component loads the question; the client component renders the quiz and handles auto-upload + retry with localStorage fallback.

- [ ] **Step 1: Write the server page**

Create `src/app/practice/[file]/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { isLocalMode } from "@/lib/env";
import { loadQuestion } from "@/lib/load-questions";
import { PracticeClient } from "./PracticeClient";

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
    <main className="max-w-2xl mx-auto p-8">
      <PracticeClient question={question} />
    </main>
  );
}
```

- [ ] **Step 2: Write the client component**

Create `src/app/practice/[file]/PracticeClient.tsx`:

```tsx
"use client";

import { useState } from "react";
import { CompleteTheWords } from "@/components/CompleteTheWords";
import type { Question, BlankAnswer } from "@/lib/types";
import type { GradeResult } from "@/lib/grade";

type SyncState = "idle" | "syncing" | "ok" | "failed";

interface ResultsPayload {
  question: Question;
  answers: BlankAnswer[];
  score: number;
}

export function PracticeClient({ question }: { question: Question }) {
  const [sync, setSync] = useState<SyncState>("idle");
  const [lastPayload, setLastPayload] = useState<ResultsPayload | null>(null);

  async function upload(payload: ResultsPayload) {
    setSync("syncing");
    try {
      const res = await fetch("/api/local-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setSync("ok");
    } catch {
      setSync("failed");
      localStorage.setItem("pending-result", JSON.stringify(payload));
    }
  }

  function onGraded(result: GradeResult) {
    const payload: ResultsPayload = {
      question,
      answers: result.answers,
      score: result.score,
    };
    setLastPayload(payload);
    void upload(payload);
  }

  return (
    <div className="space-y-4">
      <CompleteTheWords question={question} mode="answer" showHints onGraded={onGraded} />

      {sync === "syncing" && <p className="text-gray-500">Syncing…</p>}
      {sync === "ok" && <p className="text-green-600">Synced to cloud.</p>}
      {sync === "failed" && (
        <div className="text-red-600 space-x-2">
          <span>Sync failed (saved locally).</span>
          <button
            className="underline"
            onClick={() => lastPayload && upload(lastPayload)}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
```

> Note: the client posts to a **local** proxy route `/api/local-sync` (next task) so the `UPLOAD_TOKEN` and `RESULTS_ENDPOINT` stay server-side and are never exposed to the browser.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: local practice page with auto-upload + retry"
```

---

## Task 11: Local sync proxy route

**Files:**
- Create: `src/app/api/local-sync/route.ts`

This server route runs only locally; it forwards the payload to the deployed `/api/results` with the Bearer token.

- [ ] **Step 1: Write the proxy route**

Create `src/app/api/local-sync/route.ts`:

```ts
import { NextResponse } from "next/server";
import { isLocalMode, getResultsEndpoint, getUploadToken } from "@/lib/env";

export async function POST(req: Request) {
  if (!isLocalMode()) {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }
  const body = await req.text();
  const res = await fetch(getResultsEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getUploadToken()}`,
    },
    body,
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: `upstream ${res.status}` },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: local sync proxy keeps upload token server-side"
```

---

## Task 12: Results ingestion logic (TDD)

**Files:**
- Create: `src/lib/ingest.ts`
- Test: `tests/api-results.test.ts`

The ingestion logic is extracted into a pure-ish function that takes a `db`-like object so it can be unit-tested with a fake. It upserts the question (dedupe by passage+source), inserts an attempt, and upserts each wrong word.

- [ ] **Step 1: Write the failing test with a fake DB**

Create `tests/api-results.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ingestResult, type IngestDeps } from "@/lib/ingest";
import type { Question, BlankAnswer } from "@/lib/types";

const question: Question = {
  topic: "t",
  source: "2026-06-08-b1",
  passage: "di_____ prov___",
  blanks: [
    { index: 0, shown: "di", answer: "diverse" },
    { index: 1, shown: "prov", answer: "provide" },
  ],
};

const answers: BlankAnswer[] = [
  { index: 0, typed: "verse", correct: true },
  { index: 1, typed: "xyz", correct: false },
];

function makeFakeDeps() {
  const calls = {
    upsertQuestion: [] as Question[],
    insertAttempt: [] as { questionId: string; score: number }[],
    upsertWrongWord: [] as string[],
  };
  const deps: IngestDeps = {
    async upsertQuestion(q) {
      calls.upsertQuestion.push(q);
      return "q-id-1";
    },
    async insertAttempt(a) {
      calls.insertAttempt.push(a);
    },
    async upsertWrongWord(word) {
      calls.upsertWrongWord.push(word);
    },
  };
  return { deps, calls };
}

describe("ingestResult", () => {
  it("upserts question, inserts attempt, records only wrong words", async () => {
    const { deps, calls } = makeFakeDeps();
    await ingestResult(deps, { question, answers, score: 1 });

    expect(calls.upsertQuestion).toHaveLength(1);
    expect(calls.insertAttempt).toEqual([{ questionId: "q-id-1", score: 1 }]);
    expect(calls.upsertWrongWord).toEqual(["provide"]); // only the incorrect blank's answer
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/api-results.test.ts`
Expected: FAIL — cannot find module `@/lib/ingest`.

- [ ] **Step 3: Write the ingestion logic**

Create `src/lib/ingest.ts`:

```ts
import type { Question, BlankAnswer } from "./types";

export interface IngestPayload {
  question: Question;
  answers: BlankAnswer[];
  score: number;
}

export interface IngestDeps {
  upsertQuestion(q: Question): Promise<string>; // returns question id
  insertAttempt(a: { questionId: string; score: number; answers: BlankAnswer[] }): Promise<void>;
  upsertWrongWord(word: string, questionId: string): Promise<void>;
}

export async function ingestResult(
  deps: IngestDeps,
  payload: IngestPayload
): Promise<void> {
  const questionId = await deps.upsertQuestion(payload.question);
  await deps.insertAttempt({
    questionId,
    score: payload.score,
    answers: payload.answers,
  });

  for (const a of payload.answers) {
    if (a.correct) continue;
    const blank = payload.question.blanks.find((b) => b.index === a.index);
    if (blank) await deps.upsertWrongWord(blank.answer, questionId);
  }
}
```

> The test's fake `insertAttempt`/`upsertWrongWord` ignore extra args, so the richer real signatures (with `answers`, `questionId`) remain compatible.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/api-results.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: ingestResult logic with injected deps"
```

---

## Task 13: Drizzle-backed ingestion deps + /api/results route

**Files:**
- Create: `src/db/ingest-deps.ts`
- Create: `src/app/api/results/route.ts`

- [ ] **Step 1: Write the Drizzle deps implementation**

Create `src/db/ingest-deps.ts`:

```ts
import { eq, sql } from "drizzle-orm";
import { db } from "./client";
import { questions, attempts, wrongWords } from "./schema";
import type { IngestDeps } from "@/lib/ingest";

export const drizzleIngestDeps: IngestDeps = {
  async upsertQuestion(q) {
    // Dedupe by passage+source: reuse if it already exists.
    const existing = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.passage, q.passage))
      .limit(1);
    if (existing[0]) return existing[0].id;

    const inserted = await db
      .insert(questions)
      .values({
        passage: q.passage,
        blanks: q.blanks,
        topic: q.topic,
        source: q.source,
      })
      .returning({ id: questions.id });
    return inserted[0].id;
  },

  async insertAttempt(a) {
    await db.insert(attempts).values({
      questionId: a.questionId,
      score: a.score,
      answers: a.answers,
    });
  },

  async upsertWrongWord(word, questionId) {
    await db
      .insert(wrongWords)
      .values({ word, lastQuestionId: questionId })
      .onConflictDoUpdate({
        target: wrongWords.word,
        set: {
          wrongCount: sql`${wrongWords.wrongCount} + 1`,
          lastQuestionId: questionId,
          lastWrongAt: sql`now()`,
        },
      });
  },
};
```

- [ ] **Step 2: Write the API route**

Create `src/app/api/results/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getUploadToken } from "@/lib/env";
import { questionSchema } from "@/lib/question-schema";
import { ingestResult } from "@/lib/ingest";
import { drizzleIngestDeps } from "@/db/ingest-deps";
import { z } from "zod";

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
```

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: /api/results route with token auth and drizzle ingestion"
```

---

## Task 14: NextAuth GitHub OAuth with allowlist

**Files:**
- Create: `src/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/middleware.ts`

- [ ] **Step 1: Write the NextAuth config with allowlist**

Create `src/auth.ts`:

```ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { getAllowedGithubLogin } from "@/lib/env";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      // GitHub profile.login is the username.
      const login = (profile as { login?: string } | undefined)?.login;
      return login === getAllowedGithubLogin();
    },
  },
});
```

- [ ] **Step 2: Write the auth route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 3: Write middleware to protect cloud routes**

Create `src/middleware.ts`:

```ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  // Local mode and the auth/results APIs are exempt.
  if (process.env.LOCAL_MODE === "1") return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/results")
  ) {
    return NextResponse.next();
  }
  if (!req.auth) {
    const url = new URL("/api/auth/signin", req.nextUrl.origin);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 4: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: GitHub OAuth with single-account allowlist + route protection"
```

---

## Task 15: Cloud review pages

**Files:**
- Create: `src/app/review/page.tsx`
- Create: `src/app/review/[id]/page.tsx`
- Create: `src/app/review/[id]/ReviewClient.tsx`

- [ ] **Step 1: Write the review list page**

Create `src/app/review/page.tsx`:

```tsx
import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { questions, attempts } from "@/db/schema";

export default async function ReviewList({
  searchParams,
}: {
  searchParams: Promise<{ wrongOnly?: string }>;
}) {
  const { wrongOnly } = await searchParams;

  let questionIds: string[] | null = null;
  if (wrongOnly === "1") {
    // questions that have at least one attempt scoring below total blanks
    const rows = await db
      .select({ id: attempts.questionId, score: attempts.score })
      .from(attempts);
    const wrongSet = new Set<string>();
    // mark a question as "wrong" if any attempt missed at least one blank
    for (const r of rows) wrongSet.add(r.id); // refined below in step note
    questionIds = [...wrongSet];
  }

  const list = questionIds
    ? questionIds.length
      ? await db.select().from(questions).where(inArray(questions.id, questionIds)).orderBy(desc(questions.createdAt))
      : []
    : await db.select().from(questions).orderBy(desc(questions.createdAt));

  return (
    <main className="max-w-2xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold">Review</h1>
      <div className="space-x-4 text-sm">
        <Link className="underline" href="/review">All</Link>
        <Link className="underline" href="/review?wrongOnly=1">Answered wrong</Link>
        <Link className="underline" href="/wrong-words">Wrong words</Link>
      </div>
      <ul className="space-y-2">
        {list.map((q) => (
          <li key={q.id}>
            <Link className="text-blue-600 underline" href={`/review/${q.id}`}>
              {q.topic} — {new Date(q.createdAt).toLocaleDateString()}
            </Link>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="text-gray-500">Nothing here yet.</p>}
    </main>
  );
}
```

> Refinement for `wrongOnly`: a question counts as "answered wrong" when an attempt's `score` is less than the number of blanks. Replace the loop body in step 1 with the join below in step 2.

- [ ] **Step 2: Refine wrongOnly filtering**

Replace the `if (wrongOnly === "1") { ... }` block in `src/app/review/page.tsx` with:

```tsx
  if (wrongOnly === "1") {
    const rows = await db
      .select({
        id: attempts.questionId,
        score: attempts.score,
      })
      .from(attempts);
    const blanksByQuestion = new Map<string, number>();
    const qs = await db.select({ id: questions.id, blanks: questions.blanks }).from(questions);
    for (const q of qs) blanksByQuestion.set(q.id, q.blanks.length);
    const wrongSet = new Set<string>();
    for (const r of rows) {
      const total = blanksByQuestion.get(r.id) ?? Infinity;
      if (r.score < total) wrongSet.add(r.id);
    }
    questionIds = [...wrongSet];
  }
```

- [ ] **Step 3: Write the single-question review server page**

Create `src/app/review/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { questions } from "@/db/schema";
import type { Question } from "@/lib/types";
import { ReviewClient } from "./ReviewClient";

export default async function ReviewOne({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
```

- [ ] **Step 4: Write the review client wrapper**

Create `src/app/review/[id]/ReviewClient.tsx`:

```tsx
"use client";

import { CompleteTheWords } from "@/components/CompleteTheWords";
import type { Question } from "@/lib/types";

export function ReviewClient({ question }: { question: Question }) {
  // Replay only: grade locally, no upload.
  return <CompleteTheWords question={question} mode="answer" />;
}
```

- [ ] **Step 5: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: cloud review list and single-question replay"
```

---

## Task 16: Wrong-words page

**Files:**
- Create: `src/app/wrong-words/page.tsx`

- [ ] **Step 1: Write the wrong-words page**

Create `src/app/wrong-words/page.tsx`:

```tsx
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { wrongWords } from "@/db/schema";

export default async function WrongWordsPage() {
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
              <td className="py-2">{new Date(w.lastWrongAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="text-gray-500">No wrong words yet.</p>}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: wrong-words book page"
```

---

## Task 17: Example question fixture + full local flow check

**Files:**
- Create: `questions/2026-06-08-example.json` (force-added past gitignore for the contract example)

- [ ] **Step 1: Write the example question**

Create `questions/2026-06-08-example.json`:

```json
{
  "topic": "Marine Biology",
  "source": "2026-06-08-example",
  "passage": "Coral reefs are among the most di_____ ecosystems on Earth. They prov___ shelter for thousands of spec___ and support coastal commun_____ that depend on fishing and tourism.",
  "blanks": [
    { "index": 0, "shown": "di", "answer": "diverse", "hint": "varied" },
    { "index": 1, "shown": "prov", "answer": "provide" },
    { "index": 2, "shown": "spec", "answer": "species" },
    { "index": 3, "shown": "commun", "answer": "communities" }
  ]
}
```

- [ ] **Step 2: Force-add the example past gitignore**

```bash
git add -f questions/2026-06-08-example.json
```

- [ ] **Step 3: Run the full local flow manually**

```bash
cp .env.local.example .env.local
# In .env.local set LOCAL_MODE=1 and a dummy RESULTS_ENDPOINT/UPLOAD_TOKEN
LOCAL_MODE=1 npm run dev
```

Visit `http://localhost:3000`, click the example, fill blanks, Submit.
Expected: score shows; sync indicator shows "failed" (no real endpoint) and Retry appears — confirms graceful failure path.

- [ ] **Step 4: Run the whole test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: example question fixture and local flow verification"
```

---

## Task 18: Deployment notes

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README with setup + deploy steps**

Create `README.md`:

```markdown
# TOEFL Complete-the-Words Tutor

Single-user tool: Claude Code authors questions locally; you practice locally; results sync to a Vercel + Neon cloud practice site.

## Local authoring & practice

1. `cp .env.local.example .env.local` and set `LOCAL_MODE=1`, `RESULTS_ENDPOINT` (your deployed `/api/results`), `UPLOAD_TOKEN`.
2. Ask Claude Code to write questions into `questions/*.json` (see `questions/2026-06-08-example.json` for the format).
3. `LOCAL_MODE=1 npm run dev` → open http://localhost:3000.

## Cloud deploy (Vercel)

1. Create a Neon Postgres DB; set `DATABASE_URL`.
2. `npm run db:push` to create tables.
3. Create a GitHub OAuth app; set `GITHUB_ID`, `GITHUB_SECRET`, callback `https://<app>/api/auth/callback/github`.
4. Set `ALLOWED_GITHUB_LOGIN`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `UPLOAD_TOKEN` (same as local).
5. Do **not** set `LOCAL_MODE` in production.
6. Deploy. Visit `/review`; sign in with GitHub.

## Tests

`npm test`
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "docs: README with setup and deploy steps"
```

---

## Self-Review Notes

- **Spec coverage:** architecture (Tasks 1,5,9–16) · data model (Task 5) · authoring JSON contract (Tasks 3,7,17) · shared `CompleteTheWords` + `gradeAttempt` (Tasks 4,8) · local routes (9,10) · cloud routes (15,16) · `/api/results` upsert (12,13) · error handling: upload retry+localStorage (10), zod bad-file (7,9), 401 (13), OAuth allowlist (14) · testing (3,4,12,17) · env vars (5,6).
- **Token never in browser:** local client posts to `/api/local-sync` proxy (Task 11), which holds `UPLOAD_TOKEN` server-side.
- **Type consistency:** `gradeAttempt`/`GradeResult`/`BlankAnswer`/`Question`/`Blank` names are consistent across Tasks 3,4,8,10,12,13.
