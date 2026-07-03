# Production Flashcards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Production" flashcard mode where the learner writes a sentence using the target word and gets compact AI feedback (verdict + rewrite + tip), then self-grades into the existing Leitner schedule.

**Architecture:** A provider-agnostic `SentenceEvaluator` interface with a Gemini implementation, called from a thin `/api/flashcards/evaluate` route. The flashcards page gains a Recognition/Production toggle; Production renders a new `ProductionCard` component that reuses the existing due deck and `/api/flashcards/review` grading.

**Tech Stack:** Next.js 16 App Router route handlers, TypeScript, zod, Gemini REST (`generateContent` with `responseSchema`), React client components, vitest.

**Branch:** All work on `dev`; promote to `main` once `verify` CI is green (per the project's dev→main workflow). Commit messages in English.

---

### Task 1: AI evaluation core (types, schemas, prompt, parsing, orchestration)

**Files:**
- Create: `src/lib/ai/types.ts`
- Create: `src/lib/ai/evaluate.ts`
- Test: `tests/ai-evaluate.test.ts`

- [ ] **Step 1: Create the types**

`src/lib/ai/types.ts`:

```ts
export interface EvaluateInput {
  word: string;
  meaning?: string;
  sentence: string;
}

export interface Feedback {
  ok: boolean; // target word used correctly and naturally
  rewrite: string; // a more natural version of the learner's sentence
  tip: string; // one key collocation / register / grammar note
}

export interface SentenceEvaluator {
  evaluate(input: EvaluateInput): Promise<Feedback>;
}
```

- [ ] **Step 2: Write the failing test**

`tests/ai-evaluate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  buildPrompt,
  parseFeedback,
  runEvaluation,
} from "@/lib/ai/evaluate";
import type { SentenceEvaluator, Feedback } from "@/lib/ai/types";

describe("buildPrompt", () => {
  it("includes the target word and the learner sentence", () => {
    const p = buildPrompt({ word: "gather", meaning: "come together", sentence: "Birds gather here." });
    expect(p).toContain("gather");
    expect(p).toContain("Birds gather here.");
    expect(p).toContain("come together");
  });
});

describe("parseFeedback", () => {
  it("accepts a valid JSON string", () => {
    const f = parseFeedback('{"ok":true,"rewrite":"Birds gather here.","tip":"Good collocation."}');
    expect(f).toEqual({ ok: true, rewrite: "Birds gather here.", tip: "Good collocation." });
  });

  it("accepts an already-parsed object", () => {
    const f = parseFeedback({ ok: false, rewrite: "x", tip: "y" });
    expect(f.ok).toBe(false);
  });

  it("throws on a malformed shape", () => {
    expect(() => parseFeedback('{"ok":"yes"}')).toThrow();
  });
});

describe("runEvaluation", () => {
  const okEvaluator: SentenceEvaluator = {
    async evaluate() {
      return { ok: true, rewrite: "r", tip: "t" } satisfies Feedback;
    },
  };

  it("returns feedback for a valid payload", async () => {
    const r = await runEvaluation(okEvaluator, { word: "gather", sentence: "Birds gather." });
    expect(r).toEqual({ status: 200, feedback: { ok: true, rewrite: "r", tip: "t" } });
  });

  it("rejects an invalid payload with 400", async () => {
    const r = await runEvaluation(okEvaluator, { word: "", sentence: "" });
    expect(r).toEqual({ status: 400, error: "invalid payload" });
  });

  it("maps evaluator failure to 502", async () => {
    const failing: SentenceEvaluator = {
      async evaluate() {
        throw new Error("boom");
      },
    };
    const r = await runEvaluation(failing, { word: "gather", sentence: "Birds gather." });
    expect(r).toEqual({ status: 502, error: "evaluation unavailable" });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run tests/ai-evaluate.test.ts`
Expected: FAIL — `@/lib/ai/evaluate` not found.

- [ ] **Step 4: Implement `src/lib/ai/evaluate.ts`**

```ts
import { z } from "zod";
import type { EvaluateInput, Feedback, SentenceEvaluator } from "./types";

export const inputSchema = z.object({
  word: z.string().min(1),
  meaning: z.string().optional(),
  sentence: z.string().min(1).max(500),
});

export const feedbackSchema = z.object({
  ok: z.boolean(),
  rewrite: z.string().min(1),
  tip: z.string().min(1),
});

export function buildPrompt(input: EvaluateInput): string {
  const meaning = input.meaning ? ` (meaning: ${input.meaning})` : "";
  return [
    "You are a concise TOEFL writing tutor.",
    `A learner is practising using the word "${input.word}"${meaning}.`,
    `Their sentence: "${input.sentence}"`,
    "",
    `Judge ONLY whether "${input.word}" is used correctly and naturally.`,
    'Respond with JSON: { "ok": boolean, "rewrite": string, "tip": string }',
    "- ok: true if the target word is used correctly and naturally, else false.",
    "- rewrite: a natural, corrected one-sentence version that keeps their meaning.",
    "- tip: ONE short, concrete note on collocation, register, or grammar. Under 20 words.",
  ].join("\n");
}

export function parseFeedback(raw: unknown): Feedback {
  const value = typeof raw === "string" ? JSON.parse(raw) : raw;
  return feedbackSchema.parse(value);
}

export type EvalResult =
  | { status: 200; feedback: Feedback }
  | { status: 400 | 502; error: string };

export async function runEvaluation(
  evaluator: SentenceEvaluator,
  rawBody: unknown
): Promise<EvalResult> {
  const parsed = inputSchema.safeParse(rawBody);
  if (!parsed.success) return { status: 400, error: "invalid payload" };
  try {
    const feedback = await evaluator.evaluate(parsed.data);
    return { status: 200, feedback };
  } catch {
    return { status: 502, error: "evaluation unavailable" };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/ai-evaluate.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/types.ts src/lib/ai/evaluate.ts tests/ai-evaluate.test.ts
git commit -m "feat: add provider-agnostic sentence-evaluation core"
```

---

### Task 2: Gemini evaluator + provider factory

**Files:**
- Create: `src/lib/ai/gemini.ts`
- Create: `src/lib/ai/provider.ts`
- Test: `tests/ai-provider.test.ts`

- [ ] **Step 1: Implement the Gemini evaluator**

`src/lib/ai/gemini.ts`:

```ts
import { buildPrompt, parseFeedback } from "./evaluate";
import type { EvaluateInput, Feedback, SentenceEvaluator } from "./types";

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

const responseSchema = {
  type: "OBJECT",
  properties: {
    ok: { type: "BOOLEAN" },
    rewrite: { type: "STRING" },
    tip: { type: "STRING" },
  },
  required: ["ok", "rewrite", "tip"],
} as const;

export function createGeminiEvaluator(config: GeminiConfig): SentenceEvaluator {
  return {
    async evaluate(input: EvaluateInput): Promise<Feedback> {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${config.model}` +
        `:generateContent?key=${config.apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(input) }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.3,
          },
        }),
      });
      if (!res.ok) throw new Error(`gemini ${res.status}`);
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== "string") throw new Error("gemini: no text in response");
      return parseFeedback(text);
    },
  };
}
```

- [ ] **Step 2: Write the failing test for the factory**

`tests/ai-provider.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { getEvaluator } from "@/lib/ai/provider";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("getEvaluator", () => {
  it("throws when GEMINI_API_KEY is missing", () => {
    delete process.env.AI_PROVIDER;
    delete process.env.GEMINI_API_KEY;
    expect(() => getEvaluator()).toThrow(/GEMINI_API_KEY/);
  });

  it("returns an evaluator when configured", () => {
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    const e = getEvaluator();
    expect(typeof e.evaluate).toBe("function");
  });

  it("throws on an unknown provider", () => {
    process.env.AI_PROVIDER = "nope";
    expect(() => getEvaluator()).toThrow(/unknown AI_PROVIDER/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run tests/ai-provider.test.ts`
Expected: FAIL — `@/lib/ai/provider` not found.

- [ ] **Step 4: Implement the factory**

`src/lib/ai/provider.ts`:

```ts
import { createGeminiEvaluator } from "./gemini";
import type { SentenceEvaluator } from "./types";

export function getEvaluator(): SentenceEvaluator {
  const provider = process.env.AI_PROVIDER ?? "gemini";
  if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    return createGeminiEvaluator({ apiKey, model });
  }
  throw new Error(`unknown AI_PROVIDER: ${provider}`);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/ai-provider.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/gemini.ts src/lib/ai/provider.ts tests/ai-provider.test.ts
git commit -m "feat: add Gemini evaluator and provider factory"
```

---

### Task 3: `/api/flashcards/evaluate` route

**Files:**
- Create: `src/app/api/flashcards/evaluate/route.ts`

- [ ] **Step 1: Implement the route**

`src/app/api/flashcards/evaluate/route.ts`:

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Manual smoke test (requires GEMINI_API_KEY in .env.local)**

Run: `LOCAL_MODE=1 pnpm dev` in one terminal, then in another:

```bash
curl -s -X POST http://localhost:3000/api/flashcards/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"word":"gather","meaning":"come together","sentence":"People gather in the square."}'
```

Expected: JSON like `{"ok":true,"rewrite":"...","tip":"..."}`.
Also verify the failure path: temporarily rename the key and confirm a `{"error":...}` with a non-200 status; the UI must still work (Task 4/5 handle degradation).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/flashcards/evaluate/route.ts
git commit -m "feat: add flashcard sentence-evaluation API route"
```

---

### Task 4: `ProductionCard` component

**Files:**
- Create: `src/app/flashcards/ProductionCard.tsx`

- [ ] **Step 1: Implement the component**

`src/app/flashcards/ProductionCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { ReviewResult } from "@/lib/leitner";
import type { Feedback } from "@/lib/ai/types";
import type { StudyCard } from "./StudyClient";

export function ProductionCard({
  card,
  onGrade,
  busy,
}: {
  card: StudyCard;
  onGrade: (result: ReviewResult) => void;
  busy: boolean;
}) {
  const [sentence, setSentence] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function getFeedback() {
    if (!sentence.trim() || state === "loading") return;
    setState("loading");
    setFeedback(null);
    try {
      const res = await fetch("/api/flashcards/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: card.word, meaning: card.hint, sentence }),
      });
      if (!res.ok) throw new Error();
      setFeedback((await res.json()) as Feedback);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  const revealed = feedback !== null || state === "error";

  return (
    <div className="flex min-h-[16rem] flex-col rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-muted">
          {card.topic}
        </span>
        <span className="ml-auto text-muted">box {card.box}</span>
      </div>

      <div className="mt-4 space-y-1 text-center">
        <p className="font-mono text-2xl font-bold text-accent">{card.word}</p>
        <p className="text-sm text-muted">{card.hint ?? "Use this word in a sentence."}</p>
      </div>

      <label className="mt-4 block text-xs uppercase tracking-wide text-muted">
        Write a sentence using this word
      </label>
      <textarea
        className="mt-1 w-full rounded-lg border border-border bg-surface-2 p-3 text-fg outline-none focus:border-accent"
        rows={3}
        value={sentence}
        disabled={state === "loading"}
        onChange={(e) => setSentence(e.target.value)}
        placeholder={`e.g. a sentence with "${card.word}"`}
      />

      {!revealed && (
        <button
          className="mt-3 w-full rounded-lg bg-accent px-4 py-3 font-medium text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-50"
          disabled={!sentence.trim() || state === "loading"}
          onClick={getFeedback}
        >
          {state === "loading" ? "Checking…" : "Get feedback"}
        </button>
      )}

      {feedback && (
        <div className="mt-4 space-y-2 rounded-lg border border-border bg-surface-2 p-3 text-sm">
          <p className={feedback.ok ? "font-medium text-ok" : "font-medium text-bad"}>
            {feedback.ok ? "✅ Correct and natural" : "⚠️ Needs work"}
          </p>
          <p className="text-fg">
            <span className="text-muted">Rewrite: </span>
            {feedback.rewrite}
          </p>
          <p className="text-fg">
            <span className="text-muted">Tip: </span>
            {feedback.tip}
          </p>
          <p className="text-fg">
            <span className="text-muted">Example: </span>
            {card.example}
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3 text-sm text-muted">
          AI feedback unavailable — compare with the example and self-grade.
          <p className="mt-1 text-fg">
            <span className="text-muted">Example: </span>
            {card.example}
          </p>
        </div>
      )}

      {revealed && (
        <div className="mt-4 flex gap-3">
          <button
            disabled={busy}
            className="flex-1 rounded-lg border-2 border-bad/40 bg-bad-soft px-4 py-3 font-medium text-bad transition-colors hover:border-bad disabled:opacity-50"
            onClick={() => onGrade("again")}
          >
            Again
          </button>
          <button
            disabled={busy}
            className="flex-1 rounded-lg border-2 border-ok/40 bg-ok-soft px-4 py-3 font-medium text-ok transition-colors hover:border-ok disabled:opacity-50"
            onClick={() => onGrade("got")}
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors. (This task compiles but is not wired in until Task 5.)

- [ ] **Step 3: Commit**

```bash
git add src/app/flashcards/ProductionCard.tsx
git commit -m "feat: add ProductionCard flashcard UI"
```

---

### Task 5: Recognition/Production toggle in `StudyClient`

**Files:**
- Modify: `src/app/flashcards/StudyClient.tsx`

- [ ] **Step 1: Add the mode state and import**

At the top of `StudyClient` (inside the component, alongside the other `useState` calls), add:

```tsx
const [mode, setMode] = useState<"recognition" | "production">("recognition");
```

And add this import near the other imports at the top of the file:

```tsx
import { ProductionCard } from "./ProductionCard";
```

- [ ] **Step 2: Add the toggle UI**

In the returned JSX, replace the header row:

```tsx
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{queue.length} left</span>
        <Link className="hover:text-fg" href={backHref}>
          Exit
        </Link>
      </div>
```

with a version that includes a segmented toggle:

```tsx
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{queue.length} left</span>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-border p-0.5">
            <button
              className={`rounded-md px-2.5 py-1 text-xs ${mode === "recognition" ? "bg-accent text-accent-fg" : "text-muted"}`}
              onClick={() => setMode("recognition")}
            >
              Recognition
            </button>
            <button
              className={`rounded-md px-2.5 py-1 text-xs ${mode === "production" ? "bg-accent text-accent-fg" : "text-muted"}`}
              onClick={() => setMode("production")}
            >
              Production
            </button>
          </div>
          <Link className="hover:text-fg" href={backHref}>
            Exit
          </Link>
        </div>
      </div>
```

- [ ] **Step 3: Branch the card body on mode**

Wrap the existing recognition card+buttons block so it only renders in recognition mode, and render `ProductionCard` in production mode. Immediately after the header `</div>` from Step 2, insert:

```tsx
      {mode === "production" ? (
        <ProductionCard
          key={current.word}
          card={current}
          onGrade={grade}
          busy={busy}
        />
      ) : (
        <>
          {/* existing recognition card container + Show answer / Again / Got it */}
        </>
      )}
```

Move the existing recognition JSX (the `<div className="flex min-h-[16rem] ...">` card block and the `{!flipped ? (...Show answer...) : (...Again/Got it...)}` block) inside the `<>...</>` recognition branch. Do not change the recognition markup itself.

- [ ] **Step 4: Typecheck + lint + tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: no errors; all existing tests pass.

- [ ] **Step 5: Manual verification**

Run: `LOCAL_MODE=1 pnpm dev`, open `http://localhost:3000/flashcards`.
- Toggle to **Production**: the card shows the word + meaning + a textarea.
- Type a sentence, press **Get feedback** → feedback (verdict/rewrite/tip) + example appear, then **Again/Got it** advance the card.
- Toggle back to **Recognition**: the original flip card still works.
- With the key removed, **Get feedback** shows the degradation message and Again/Got it still work.

- [ ] **Step 6: Commit**

```bash
git add src/app/flashcards/StudyClient.tsx
git commit -m "feat: add Recognition/Production mode toggle to flashcards"
```

---

### Task 6: Config docs + build verification + promote

**Files:**
- Modify: `.env.local.example`
- Modify: `README.md`

- [ ] **Step 1: Document env vars in `.env.local.example`**

Append:

```bash
# AI feedback for Production flashcards (Google AI Studio free key).
# AI_PROVIDER=gemini
# GEMINI_API_KEY=your-key
# GEMINI_MODEL=gemini-2.5-flash
```

- [ ] **Step 2: Add a README note**

Under the flashcards/highlights section of `README.md`, add:

```md
Production flashcards ask you to write a sentence with the target word and give
AI feedback (Google Gemini free tier, `GEMINI_API_KEY`). It degrades gracefully:
without a key, the card falls back to self-assessment against the example.
```

- [ ] **Step 3: Full verification**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all pass; build succeeds.

- [ ] **Step 4: Commit and push to dev**

```bash
git add .env.local.example README.md
git commit -m "docs: document GEMINI_API_KEY for production flashcards"
git push origin HEAD:dev
```

- [ ] **Step 5: Set the cloud env var**

In Vercel → Settings → Environment Variables (Production): add `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`). Do this before promoting so the deployed feature works.

- [ ] **Step 6: Wait for CI, then promote to main**

After `verify` is green on the dev commit:

```bash
git push origin dev:main   # or: git push origin HEAD:main from the dev tip
```

Confirm the production deployment is READY and try Production mode at `https://toefl-tutor.vercel.app/flashcards`.

---

## Self-Review

**Spec coverage:**
- AI feedback via Gemini, provider-agnostic → Tasks 1–2 (interface + factory). ✓
- Front shows word + meaning, write a sentence → Task 4 (`ProductionCard`). ✓
- Toggle on flashcards page, reuse deck + Leitner → Task 5 (reuses `grade`, same `queue`). ✓
- Compact structured feedback (ok/rewrite/tip) JSON → Task 1 (`feedbackSchema`), Task 2 (`responseSchema`). ✓
- Graceful degradation → Task 4 (`state === "error"`), Task 3 (error statuses). ✓
- Config (`GEMINI_API_KEY`, model, provider) → Task 2 factory, Task 6 docs. ✓
- Testing (evaluate + route logic with fakes) → Tasks 1–2 unit tests. ✓
- No schema change, no persistence, no recall mode → nothing in the plan adds them. ✓

**Placeholder scan:** No TBD/TODO; all code shown. Task 5 Step 3 references "existing recognition JSX" — it is explicit about moving the already-present block unchanged, not inventing new code.

**Type consistency:** `Feedback { ok, rewrite, tip }` is identical across `types.ts`, `feedbackSchema`, Gemini `responseSchema`, and `ProductionCard`. `SentenceEvaluator.evaluate(EvaluateInput)` and `runEvaluation(evaluator, rawBody)` signatures match their tests. `ReviewResult` and `StudyCard` are imported from their existing modules (`@/lib/leitner`, `./StudyClient`).
