# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install                 # install dependencies (pnpm only — there is a pnpm-lock.yaml)
pnpm dev                     # next dev
pnpm typecheck               # tsc --noEmit; run before declaring work done
pnpm build                   # next build; catches runtime issues typecheck misses
pnpm seed                    # idempotent loader: upserts /seeds/initial-objects, then runs each /seeds/interviews/*.md through the real extraction + synthesis pipelines. Costs Anthropic credit.
pnpm provision-elevenlabs    # creates the two ElevenLabs agents on first deploy, or PATCHes them idempotently when ELEVENLABS_AGENT_* env vars are already set
```

There is no test suite. Verification is `pnpm typecheck && pnpm build`.

`pnpm seed` requires a live `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `ANTHROPIC_API_KEY` in `.env`. It can also be invoked from the admin UI at `/admin` via the **Seed corpus** button, which calls `/api/admin/seed` (same code path, `maxDuration=300`).

## Architecture

Practice Commons is a Next.js 15 App Router app. Backend state lives in Supabase (Postgres). All content is synthesized from contributor input by Claude (Sonnet/Opus via `@anthropic-ai/sdk`); voice contributions go through ElevenLabs Conversational AI in-browser.

### The mental model

There are exactly four **object types**: `program`, `paper`, `question`, `specialist`. Each object has a synthesized `body` derived from one or more `mentions`, which are extracted fragments from `contributions` (free-form text or voice transcripts). The pipelines move data through this graph:

```
contribution (raw_input) ──extraction──▶ mentions ──synthesis──▶ object.body
                                                       ▲
                                                       │ admin "Regenerate"
chat-bar query ──corpus prompt──▶ answer with [ref: type/slug] citations
```

Three invariants that the code depends on and must not be broken:

1. **`contributions.raw_input` is source-of-truth.** Never truncated, never overwritten. `mentions` are derived; the admin "Re-run extraction" replays the stored raw_input against the current prompt to rebuild them.
2. **Specialists never synthesize.** Enforced in `lib/extraction.ts` (skips `type === 'specialist'` mentions) AND in `lib/synthesis.ts` (early return). Specialist pages render frontmatter only. Don't add code that synthesizes Specialist bodies — it's a deliberate MVP scope cut.
3. **All DB access goes through the server using `SUPABASE_SERVICE_ROLE_KEY`.** RLS is enabled on every table with no policies (deny-by-default for `anon`/`authenticated`). `lib/supabase.ts` is the only place that creates a client; it imports `server-only`.

### Pipelines (lib/)

- **`extraction.ts`** — input: raw text + optional page context. Loads alias index, calls extraction prompt (complexity 5), parses `{mentions: [...]}` JSON (with one retry on malformed), upserts new objects with kebab-case slugs (collision handling `-2`, `-3`), inserts `mentions` rows, then synthesizes each affected non-Specialist object. Has **three callers**: `/api/contribute` (text forms), `lib/voice.ts` (voice completion), and `lib/seed.ts` (seed loader). The exported `runExtraction` accepts an optional pre-inserted `contribution_id` so all three callers share one path — preserve that signature.
- **`synthesis.ts`** — input: object id. Loads object + mentions chronologically, calls synthesis prompt (complexity 7) with `{well_supported_threshold}` from env, writes `body` + `last_synthesized_at`. Output contains inline `[well-supported]` / `[single-source]` / `[contested]` markers. Independently callable from the admin "Regenerate" button.
- **`chatbar.ts`** — formats all non-empty object bodies as a corpus block, calls chat-bar prompt (complexity 8), parses `[ref: <type>/<slug>]` citations, logs to `queries` table. A refusal is detected by the prompt-defined prefix `"The bin doesn't cover this yet"`.
- **`llm.ts`** — central Anthropic wrapper. `complexity 1–8` → `SONNET_MODEL`, `9–10` → `OPUS_MODEL`. Exponential-backoff retry on 429/5xx/connection errors. Always use this; never instantiate `Anthropic` elsewhere.
- **`prompts.ts`** — `loadPrompt(name)` checks `prompt_overrides` table first, falls back to `/prompts/<name>.md` (cached). `substitute()` does `{variable}` interpolation. Five prompt names total — see the `PromptName` union.
- **`parsing.ts`** — pure functions (no `server-only`) to parse `[ref: ...]` and confidence markers. Used by both server pipelines and client components for citation rendering.
- **`voice.ts`** + **`elevenlabs.ts`** — `finalizeVoiceSession` flattens a transcript and feeds it to `runExtraction`. `elevenlabs.ts` is the REST client (signed URL minting, conversation fetch, agent provisioning).
- **`admin.ts`** — admin-only primitives: `mergeObjects` (atomic: repoint mentions → fold aliases → delete source → re-synthesize target), `rerunExtraction` (delete prior mentions → re-extract → re-synthesize previously-affected objects whose mention count may have changed), `deleteContribution` (cascades + re-synthesizes), `deleteMentionAndResynthesize`. The merge sequence is not transactional (Supabase REST has no transactions); the operations are ordered so partial failure leaves data in a recoverable state.
- **`admin-auth.ts`** — `isAdminAuthenticated()` checks an httpOnly cookie whose value is `HMAC-SHA256(ADMIN_PASSWORD, "admin-session-v1")`. Rotating `ADMIN_PASSWORD` invalidates all sessions. Constant-time compare. **Every `/api/admin/*` route must call `isAdminAuthenticated` first.**
- **`seed.ts`** — `runSeed()` is the shared implementation behind both `pnpm seed` and `/api/admin/seed`. Idempotent (scaffolds upsert; interviews dedup on exact `raw_input` match).

### Route layout

The `app/` tree uses route groups: public pages live in `app/(public)/` (the parens are a Next.js convention — the URL is unchanged), so `app/admin/layout.tsx` and `app/(public)/layout.tsx` are siblings under a minimal root layout. This is what keeps the public TopBar from rendering on admin pages.

Admin pages render under `app/admin/layout.tsx`, which gates on `isAdminAuthenticated()` and renders `<AdminPasswordGate />` when not authed. The gate posts to `/api/admin/login`. Logout is a form POST to `/api/admin/logout` that clears the cookie and 303-redirects back to `/admin`.

### Voice flow

`POST /api/voice-interview/start` personalizes the interviewer prompt, inserts a `voice_sessions` row (`status='in_progress'`), and returns a signed URL. The client renders `VoiceInterviewWidget` which wraps `@elevenlabs/react`'s `useConversation`. When the call ends, the client POSTs `/api/voice-interview/complete`, which **claims the session via a conditional UPDATE** (`WHERE status='in_progress'`) — important for idempotency, since the client may double-fire. Fast retry window is ~14s in-band; on miss it falls back to `after()` for ~8min background retry, then status transitions to `failed`. A 15-min cron at `/api/cron/voice-sessions-sweep` (config in `vercel.json`, authed via `CRON_SECRET`) cleans up stale sessions.

The admin "Retry transcript fetch" action on `/admin/voice-sessions/[id]` re-attempts `getConversation` against the stored `conversation_id` — useful when both the in-band and background polls miss.

### Component conventions

Server components by default. Add `'use client'` only when needed (forms, the chat-bar input, the voice widget, the admin editors that hold local state). Tailwind classes reference design tokens (`bg-bg-elev`, `text-ink`, `font-display`, `border-rule`) defined in `tailwind.config.ts` + `styles/tokens.css` — don't introduce raw hex.

The admin top-bar nav lives in `components/AdminLayout.tsx`; the password gate in `components/AdminPasswordGate.tsx`. The big editors are `AdminObjectEditor`, `AdminPromptEditor`, `AdminVoiceSessionsList` — all client components driven by server-side data loaders in the corresponding `page.tsx`.

### Path alias

`@/*` resolves to the repo root (`tsconfig.json`). Always use `@/lib/...`, `@/components/...` — never relative `../../lib/...`.

### Spec sources

`docs/Practice Commons MVP — Design Spec v1.2.md` is authoritative. `docs/2026-05-22-practice-commons-mvp-design-v1.1.md` is the source for sections v1.2 marks "unchanged from v1.1". `docs/build-plan.md` describes the seven-phase ordering used to build the MVP. `docs/elevenlabs-integration.md` covers the voice integration in depth. `docs/v2-deferred.md` lists what is intentionally out of MVP scope — check it before adding contributor records, real auth, live captions, rate limiting, vector retrieval, or peer characterizations of Specialists.
