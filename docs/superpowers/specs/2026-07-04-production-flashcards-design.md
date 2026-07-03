# Production Flashcards — Design

Date: 2026-07-04
Status: Approved (brainstorming), pending implementation plan

## Goal

Bridge vocabulary from passive recognition to active production. Add a
"Production" flashcard mode where the learner writes their own sentence using a
target word and gets immediate AI feedback on whether the word is used correctly
and naturally. This implements the "pushed output + feedback" loop that turns
learned words into words the learner can actually use in speaking and writing.

## Decisions (from brainstorming)

- **Grading**: AI feedback (not self-assessment only).
- **AI backend**: Google Gemini free tier, behind a **provider-agnostic**
  interface so the model can be swapped (Claude, local Ollama) via config.
- **Front of card**: show the word + its meaning; task is to write a natural
  sentence using it (trains correct/natural *use*, the main bottleneck).
- **Placement**: a mode toggle on the existing `/flashcards` page
  (Recognition ↔ Production), reusing the same due deck and Leitner schedule.
- **Feedback shape**: compact structured JSON — verdict, rewrite, one tip.
- **Grading integration**: AI gives feedback only; the learner still self-grades
  Again/Got it, which updates the same Leitner card via the existing endpoint.

## User flow

1. On `/flashcards`, a toggle switches between **Recognition** (current) and
   **Production** (new). Both use the same due deck.
2. Production card front: `topic` chip, the target word, its meaning (`hint`),
   and a text input.
3. The learner writes a sentence using the word and presses **Get feedback**.
4. The app calls the AI evaluator and shows compact feedback:
   - `✅/⚠️` verdict — is the target word used correctly and naturally?
   - `✍️` a more natural rewrite of the learner's sentence
   - `💡` one key tip (collocation / register / grammar)
   - alongside the card's existing `example` sentence for comparison.
5. The learner self-grades **Again / Got it**, which calls the existing
   `POST /api/flashcards/review` and updates the same Leitner schedule.

## Architecture and module boundaries

```
StudyClient (mode toggle: Recognition | Production)
  └─ ProductionCard (new component; keeps StudyClient from bloating)
        │ POST /api/flashcards/evaluate { word, meaning, sentence }
        ▼
  route → SentenceEvaluator (interface)
        └─ geminiEvaluator (implementation; provider chosen from env)
```

- `src/lib/ai/types.ts` — `Feedback` type + `SentenceEvaluator` interface.
- `src/lib/ai/evaluate.ts` — provider-agnostic prompt construction + response
  parsing. Pure and unit-testable (no network).
- `src/lib/ai/gemini.ts` — Gemini REST call using
  `responseMimeType: application/json` + `responseSchema` for reliable JSON.
- `src/lib/ai/index.ts` — factory selecting the provider from `AI_PROVIDER`
  (default `gemini`).
- `src/app/api/flashcards/evaluate/route.ts` — zod-validates the payload, calls
  the evaluator, handles errors. The evaluator is **injected** (following the
  existing `ingest-deps` dependency-injection pattern) so the route is testable
  without network.
- `src/app/flashcards/ProductionCard.tsx` — the production card UI.

## Data structures

`Feedback` (also the Gemini `responseSchema`):

```ts
interface Feedback {
  ok: boolean;      // is the target word used correctly and naturally?
  rewrite: string;  // a more natural version of the learner's sentence
  tip: string;      // the single most important collocation/register/grammar note
}
```

No change to the question JSON schema; no `collocations` field in v1 (the
existing `example` is shown for comparison). Learner sentences and feedback are
**not persisted** in v1 (feedback is shown in-session only).

## Configuration

- `GEMINI_API_KEY` — free key from Google AI Studio (user obtains it).
- `AI_PROVIDER=gemini` (default), `GEMINI_MODEL=gemini-2.5-flash` (configurable).
- Local: `.env.local`. Cloud: Vercel env. The key is used only in the server
  route and never reaches the client.

## Error handling (graceful degradation)

Missing API key, network error, 429 rate limit, or a non-JSON model response →
the route returns `{ error }` and the client shows "AI feedback unavailable —
compare with the example and self-grade." The card remains fully usable
(Again/Got it still work). AI failure never blocks studying.

## Testing

- `evaluate.ts` prompt construction + response parsing: unit tests with a fake
  provider (no network).
- Route: inject a stub evaluator; test zod validation and the error/degradation
  path.
- Uses vitest; CI (`verify`) must stay green.

## Out of scope (YAGNI / not v1)

- A "hidden word" recall mode (meaning/scenario only).
- AI auto-grading of the Leitner card (v1: learner self-grades).
- Persisting learner sentences / feedback history.
- A `collocations` field on questions.

## Notes

- Production mode works in the cloud too (Gemini is reachable). Self-grading
  already writes `card_progress`; the next `pnpm db:sync` overwrites it — this is
  **pre-existing behavior**, out of scope for this feature.
- Work happens on `dev` and is promoted to `main` once verified, per the
  project's dev→main workflow.
