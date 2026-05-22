# Practice Commons MVP — Build Plan

**Companion to:** `Practice Commons MVP — Design Spec v1.2.md`
**Audience:** A coding agent executing the build phase by phase.
**Date:** 2026-05-22 (rev. 2 — reconciled against v1.1)

## How to use this document

The spec describes the finished system. This document slices it into **seven phases** to be implemented in order. Each phase lists the exact files to create, the implementation notes that matter, what it depends on, and a done-when check.

**Which spec wins.** v1.2 is authoritative. v1.1 (`2026-05-22-practice-commons-mvp-design-v1.1.md`) is the source for every section v1.2 marks "*unchanged from v1.1*" — that is §5.1, §5.2, §5.3, the reader flows §6.1, contributor flows C1/C2/C3/C6, design tokens §7.2, component conventions §7.3, responsive §7.4, admin §8.1 and most of §8.2, and seed corpus §11. Where the two conflict (anything voice/Groupstack-related, the `voice_sessions` table, the `contribution_source` enum, the file layout), v1.2 governs. Follow v1.2's §7.1 file layout, not v1.1's.

Two ground rules, both chosen deliberately:

1. **The app does not need to run between phases.** Phases are ordered by *dependency*, not by *demoability*. Phase 3 has no UI; Phase 6 cannot be exercised until Phase 5 exists. That is fine.
2. **Every file is written once, in final form.** No throwaway stubs. A file appears in exactly one phase — the first phase by which all of its dependencies exist. The one exception is configuration files (`.env.example`, `vercel.json`) seeded in Phase 1 and appended to later; each append is called out explicitly.

Why seven and not fewer: phases 2, 3, 5, 6, 7 are each a coherent layer with a single concern (shared backend primitives, server pipelines, public UI, voice, admin). Collapsing any pair produces a grab-bag phase touching unrelated subsystems. Seven is the smallest number that keeps each phase single-concern.

## Phase dependency graph

```
P1 Scaffold ──▶ P2 Data + LLM core ──▶ P3 Pipelines + API ──▶ P4 Seed corpus
                                              │
                                    ┌─────────┴─────────┐
                                    ▼                   ▼
                             P5 Public UI         P6 Voice
                                    │                   │
                                    └─────────┬─────────┘
                                              ▼
                                      P7 Admin + Docs
```

Code dependencies run left to right along the arrows. P4 (seed corpus) depends on P3 because the seed script runs the synthetic interviews *through* the extraction pipeline (v1.1 §11). P4 produces the data that P5, P6, and P7 need to be *exercised*, but no P5/P6/P7 code depends on P4 — so P4 can run in parallel with P5/P6 if two agents are working. P5 and P6 both depend on P3 and are mutually independent. P7 depends on all prior phases.

---

## Phase 1 — Project scaffold & design system

**Goal:** A typechecking Next.js 15 project with the design-token layer and full directory structure in place. No application pages yet.

**Files to create:**

- `package.json`, `pnpm-lock.yaml` — Next.js 15.1+ (App Router; 15.1+ required for `after()`, used in Phase 6), React 19, TypeScript, Tailwind CSS, `@anthropic-ai/sdk`, `@supabase/supabase-js`, `@elevenlabs/react`. Scripts: `dev`, `build`, `typecheck`, `seed` (→ `scripts/seed.ts`), `provision-elevenlabs` (→ `scripts/provision-elevenlabs-agents.ts`).
- `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`
- `tailwind.config.ts` — maps the tokens below to utility classes (`bg-accent`, `text-ink`, `font-display`, etc.) so components never reference raw hex (spec §7.2/§7.3).
- `/styles/tokens.css` — the design tokens are fully specified in v1.1 §7.2; transcribe them verbatim:
  - Colors: `--bg #F7F3EA`, `--bg-elev #FFFCF4`, `--ink #1E1A14`, `--ink-soft #4A4138`, `--muted #7A6F61`, `--rule #D9D1BF`, `--rule-soft #E8E1D2`, `--accent #7A3220`, `--accent-soft #C66B4B`, `--tag-bg #EFE8D6`.
  - Fonts: `--font-display: 'Fraunces', Georgia, 'Times New Roman', serif`; `--font-body: 'Source Serif 4', Georgia, serif`.
  - Spacing scale `--space-1`..`--space-6` (0.5/1/1.5/2/3/4 rem); radii `--radius-sm 2px`, `--radius-md 4px`.
- `/styles/globals.css` — imports tokens; sets up the web fonts (Fraunces, Source Serif 4).
- `.env.example` — seed with Phase 1–4 keys: `ANTHROPIC_API_KEY`, `SONNET_MODEL`, `OPUS_MODEL`, `WELL_SUPPORTED_THRESHOLD`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `FEEDBACK_EMAIL`. (ElevenLabs keys and `CRON_SECRET` are appended in Phase 6.)
- `.gitignore`
- Empty directory structure matching v1.2 §7.1.

**Notes:**

- Do not create `app/layout.tsx` or any page here — they are written complete in Phase 5.
- The token values above are confirmed identical to the `:root` block of the painted-door mockup `practice-commons-draft.html`. That file names the font variables `--display` / `--body`; keep the spec's `--font-display` / `--font-body` names instead.

**Depends on:** nothing.

**Done when:** `pnpm install` succeeds and `pnpm typecheck` passes on the empty project.

---

## Phase 2 — Data layer, LLM core & prompts

**Goal:** Every shared backend primitive with no UI and no business-logic pipeline: the schema, the Supabase client, the LLM wrapper, the prompt loader, the parsing utilities, all five prompt files.

**Files to create:**

- `/supabase/migrations/0001_init.sql` — the complete schema from v1.2 §4: three enums (`object_type`; `contribution_source` with values `per_page`/`general`/`voice_interview`; `voice_session_status`), and tables `objects`, `contributions`, `mentions`, `prompt_overrides`, `queries`, `voice_sessions`, with all indexes. Transcribe v1.2 §4 verbatim — it already includes `voice_sessions` and the renamed enum.
- `/lib/supabase.ts` — server-side Supabase client using `SUPABASE_SERVICE_ROLE_KEY`.
- `/lib/prompts.ts` — `loadPrompt(name)` per v1.1 §8.2 sketch: query `prompt_overrides`; on miss, return the bundled `/prompts/<name>.md` raw string; plus a `{variable}` substitution helper. Shared by `lib/llm.ts` and (Phase 6) the voice start route.
- `/lib/llm.ts` — `callLLM(opts)` per spec §3: prompt load → variable substitution → model select from `complexity` (1–8 → `SONNET_MODEL` default `claude-sonnet-4-6`; 9–10 → `OPUS_MODEL` default `claude-opus-4-7`) → Anthropic call → exponential-backoff retry (max 3) → return text. The `prompt_name` union must include all five names.
- `/lib/parsing.ts` — parse `[ref: <type>/<slug>]` citation markers and inline `[well-supported]`/`[single-source]`/`[contested]` confidence markers. Per v1.1 §7.3, yields `{ text_chunks: [{ text, label?: ConfidenceLevel }] }` for `ObjectBody` and an equivalent structure for `ChatResult`. Pure functions, no I/O.
- `/lib/content.ts` — high-level read access over `objects`/`mentions` (get by type+slug, list by type, the alias index). Depends only on `lib/supabase.ts`.
- `/prompts/extraction.md`, `/prompts/synthesis.md` (contains `{well_supported_threshold}` placeholder), `/prompts/chat-bar.md`, `/prompts/interviewer-general.md` (contains `{contributor_expertise}`), `/prompts/interviewer-per-page.md` (contains `{object_context}`). Prompt content briefs are in v1.1 §10.2.

**Notes:**

- Author all five prompt files here even though the two interviewer prompts never reach Anthropic — they are loaded via `loadPrompt` and passed to ElevenLabs in Phase 6. This keeps the prompt layer complete.
- Run the migration against a dev Supabase project to confirm it applies cleanly.

**Depends on:** P1.

**Done when:** the migration applies on a fresh Supabase project; `lib/{llm,prompts,parsing,content}.ts` typecheck; a smoke-test `callLLM` returns text.

---

## Phase 3 — Core pipelines & their API routes

**Goal:** The server-side business logic — extraction, synthesis, chat-bar — and the two non-voice API routes. Still no UI.

**Files to create:**

- `/lib/extraction.ts` — extraction pipeline per v1.1 §5.1: insert `contributions` row → load alias index → `callLLM('extraction', complexity 5)` with `{alias_index}` + `{page_context}` → parse the `{ mentions: [...] }` JSON → for each mention, insert/upsert the object (kebab-case slug with `-2`/`-3` collision handling) and insert a `mentions` row → for each affected non-`specialist` object, run synthesis → return the affected-object list. Implement both failure modes (malformed JSON: retry once then commit with zero mentions; near-duplicate canonical names: prompt prefers existing matches, cleanup deferred to admin merge).
- `/lib/synthesis.ts` — synthesis pipeline per v1.1 §5.2: load object + all mentions chronologically → `callLLM('synthesis', complexity 7)` with `{object_name}`, `{object_type}`, `{frontmatter_json}`, `{mentions_block}`, `{well_supported_threshold}` (from `WELL_SUPPORTED_THRESHOLD` env, default `"2"`) → write `body` + `last_synthesized_at`. Output is 1–3 paragraphs with inline `[well-supported]`/`[single-source]`/`[contested]` markers; the synthesis rules (cite only provided mentions, preserve mixed views, operational-not-character, reflect sparsity) are baked into the prompt.
- `/lib/chatbar.ts` — chat-bar pipeline per v1.1 §5.3: load all objects with non-empty bodies → format as blocks prefixed `## ref: <type>/<slug> — <canonical_name>` → `callLLM('chat-bar', complexity 8)` with `{corpus_block}` → extract cited slugs → look up cited objects → insert a `queries` row → return `{ answer_text, cited_objects, was_refusal }`. The refusal phrase and citation rules live in the prompt.
- `/app/api/contribute/route.ts` — `POST`: entry point for per-page, general, and (Phase 6) voice-completion contributions; runs extraction → mentions → synthesis; returns the affected-object payload for the thank-you page.
- `/app/api/chat/route.ts` — `POST {query_text}`: runs the chat-bar pipeline.

**Notes:**

- `extraction.ts` is called two ways: over HTTP from `/api/contribute`, and in-process by the Phase 6 voice-completion handler and the Phase 4 seed script. Design its exported function to accept an already-inserted `contributions` row id (or the raw input + source) so all three callers share one path.
- `synthesis.ts` is also invoked on demand from the admin "Regenerate" button (Phase 7) — keep it independently callable per `object_id`.

**Depends on:** P2.

**Done when:** all three pipeline modules and both routes typecheck; a manual `POST /api/contribute` with hand-crafted text produces `mentions` rows and a regenerated body; `POST /api/chat` returns a citation-bearing answer and a clean refusal on an out-of-corpus query.

---

## Phase 4 — Seed corpus & seed script

**Goal:** The bundled demo content and an idempotent loader that populates a fresh database — including running the synthetic interviews through the real extraction pipeline.

**Files to create:**

- `/seeds/README.md`
- `/seeds/initial-objects/` — **23 object scaffolds** (v1.1 §11): 10 Programs, 5 Papers, 5 Questions, 3 Specialists, in `programs/`, `papers/`, `questions/`, `specialists/`. Frontmatter fields per type (v1.1 §4 notes): Programs `{region, age_range, modality, types_served}`; Papers `{first_author, year, journal, doi}`; Questions `{asker_types, age_range_relevant}`; Specialists `{region, credentials, training, accepting_new_patients, age_range, modalities}`. Specialists are stub-only — frontmatter populated, `body` empty, no mentions, never synthesized.
- `/seeds/interviews/01.md`…`05.md` — five synthetic interview transcripts. Each must mention seeded objects by name **and** introduce 2–3 new objects, so the new-object branch of extraction gets exercised.
- `/seeds/queries.md` — ~10 demo queries; each should produce a substantive, well-cited answer against the seeded corpus (include at least one deliberate out-of-corpus query so the refusal path is demoable).
- `/scripts/seed.ts` — wired to `pnpm seed`. Applies the §4 migration (or assumes it applied), imports `initial-objects/` as `objects` rows, then runs each of the five interview transcripts through `lib/extraction.ts` (source `general`) to populate `contributions`, `mentions`, and synthesized bodies. Idempotent — re-running upserts rather than duplicating.

**Notes:**

- This phase is the first real integration test of the Phase 3 pipelines: a clean `pnpm seed` exercises extraction, new-object creation, and synthesis end-to-end.
- Optionally add a smoke check (in `/scripts/`) that runs each `queries.md` query and flags any unexpected refusal (v1.1 §11).

**Depends on:** P3 (extraction + synthesis), P2 (schema).

**Done when:** `pnpm seed` runs end-to-end on a fresh Supabase project, populating all 23 objects plus mentions and synthesized bodies from the five interviews; re-running creates no duplicates (acceptance criterion #8).

---

## Phase 5 — Public frontend (reader + text contribution)

**Goal:** Everything a non-admin, non-voice visitor touches: the app shell, the home/query experience, all object pages, and the text-contribution flow. Behavior is specified in v1.1 §6.1 (R1–R4) and §6.2 (C1, C2, C3, C6). The painted-door mockup `practice-commons-draft.html` is the visual and copy reference for the home page and the design language throughout — but read "Mockup reconciliation" below before copying anything from it.

**Files to create:**

- `/app/layout.tsx`, `/app/page.tsx`, `/app/q/page.tsx`. The home page (R1) follows `practice-commons-draft.html` section-for-section: masthead, "Ask the commons" chat-bar with example chips, the "For all / By some" premise grid, the "What's inside" card grid, "Who it's for," the quality argument, the contributor commitment, and the CTA strip. `q/page.tsx` (R2) renders the answer with parsed `[ref:]` spans + a cited-object sidebar, plus a refusal state with a Contribute CTA.
- `/app/programs/page.tsx` + `/app/programs/[slug]/page.tsx`; same pair for `papers`, `questions`, `specialists`. Index pages list objects alphabetically by `canonical_name` (R4). Specialist `[slug]` pages render frontmatter only — no body, no contribute affordance (R3).
- `/app/contribute/page.tsx` (C3 general paste-only entry), `/app/thank-you/page.tsx` (C6: lists affected objects + per-object extracted `text_fragment`, plus a `FEEDBACK_EMAIL` mailto).
- `/components`: `TopBar.tsx`, `ModeToggle.tsx`, `Hero.tsx`, `ChatBar.tsx`, `ChatResult.tsx`, `Citation.tsx`, `RefusalState.tsx`, `ConfidenceLabel.tsx`, `ObjectPage.tsx`, `ObjectHeader.tsx`, `ObjectBody.tsx`, `ObjectFrontmatter.tsx`, `IndexList.tsx`, `ContributorForm.tsx`, `GeneralContributeForm.tsx`, `ThankYou.tsx`.

**Notes:**

- `ModeToggle` flips Reader↔Contributor with no auth/session — state in a cookie or URL hash (C1). Contributor mode reveals the per-page `ContributorForm` on non-`specialist` object pages and adds "Contribute" / "Start a voice interview" to the top nav.
- `Citation` and `ConfidenceLabel` render the structures produced by `lib/parsing.ts` (P2). Server components by default; only forms and the chat-bar input are `'use client'` (v1.1 §7.3).
- `contribute/page.tsx` is the canonical text-contribution page and the failure-fallback target for voice (Phase 6) — do not build a separate fallback.
- `thank-you/page.tsx` is parameterized by `?contribution_id=` and is shared verbatim by the voice flow.
- Responsive (v1.1 §7.4, confirmed by the mockup's media queries): breakpoints at 900px and 560px; `.wrap` padding drops 40px → 24px; the chat-bar collapses to a vertical stack; the "What's inside" card grid collapses 4-up → 2-up (at 900px) → 1-up (at 560px); the masthead headline shrinks; two-column grids (premise, audience, CTA) collapse to one.
- The TopBar "Start a voice interview" link points at `/voice-interview`, which 404s until Phase 6 — acceptable under the no-intermediate-working-state rule.

**Depends on:** P3 (API routes), P2 (`content.ts`, `parsing.ts`). Exercising it needs P4 data.

**Done when:** acceptance criteria #1, #2, #3, #7 pass against seeded data: query → cited answer; per-page contribution → thank-you; paste into `/contribute` → objects updated; out-of-corpus query → clean refusal.

---

## Phase 6 — Voice interview integration

**Goal:** The full embedded-ElevenLabs voice path (v1.2 §5.4, §9): server client, agent provisioning, session-lifecycle routes, sweep cron, three voice UI components.

**Files to create:**

- `/lib/elevenlabs.ts` — server-side REST client per v1.2 §9.2: `getSignedUrl`, `getConversation`, `provisionAgent`. Authed with `ELEVENLABS_API_KEY`, server-only.
- `/scripts/provision-elevenlabs-agents.ts` — idempotent agent create/update per v1.2 §9.5; wired to `pnpm provision-elevenlabs`.
- `/app/api/voice-interview/start/route.ts` — personalize the interviewer prompt via `loadPrompt` → insert `voice_sessions` row (`status='in_progress'`) → mint signed URL → return session payload. Also handles the `status='abandoned'` cancel POST (v1.2 §5.4).
- `/app/api/voice-interview/complete/route.ts` — fast-retry transcript fetch (~14s, 4 attempts) → on success insert a `contributions` row (`source='voice_interview'`) and call `lib/extraction.ts` directly → on miss, background retry via `after()` (~8 min) → terminal `completed`/`failed` (v1.2 §5.4).
- `/app/api/voice-interview/status/[session_id]/route.ts` — `GET`: poll session status.
- `/app/api/cron/voice-sessions-sweep/route.ts` — `GET`, authed via `CRON_SECRET`: sweep stale sessions per v1.2 §5.4.
- `/app/voice-interview/page.tsx`, `/app/voice-interview/status/[session_id]/page.tsx`.
- `/components/VoiceInterviewForm.tsx`, `VoiceInterviewWidget.tsx` (`'use client'`, wraps `@elevenlabs/react` `useConversation`), `VoiceInterviewStatus.tsx`.
- `/docs/elevenlabs-integration.md` — standalone integration doc covering v1.2 §9 (replaces v1.1's `groupstack-contract.md`).

**Config appends:**

- `.env.example`: add `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_GENERAL`, `ELEVENLABS_AGENT_PER_PAGE`, `CRON_SECRET`.
- `vercel.json`: add the 15-minute cron for `/api/cron/voice-sessions-sweep`.

**Notes:**

- The completion handler reuses `lib/extraction.ts` from P3 — confirm its signature accepts a pre-inserted contribution id (see P3 note).
- Both agents (`general`, `per-page`) are provisioned; only `general` is surfaced in MVP UI — the per-page voice affordance is V2.
- Implement all three failure modes from v1.2 §5.4, including the `sendBeacon` `beforeunload` path.

**Depends on:** P3 (`lib/extraction.ts`), P2 (`loadPrompt` for interviewer templates), P5 (`thank-you` page, `/contribute` fallback).

**Done when:** acceptance criteria #4 and #9 pass: an in-browser voice interview resolves to the thank-you page (or polling page → thank-you / paste-fallback); `pnpm provision-elevenlabs` runs end-to-end; `/docs/elevenlabs-integration.md` is complete.

---

## Phase 7 — Admin interface & operating docs

**Goal:** The password-gated admin surface (v1.2 §8, v1.1 §8) and the final operator documentation. Last because admin reads and mutates every prior subsystem.

**Files to create:**

- `/app/admin/layout.tsx` (password gate, v1.1 §8.1), `/app/admin/page.tsx` (object index grouped by type).
- `/app/admin/object/[type]/[slug]/page.tsx` (frontmatter editor, synthesis view + Regenerate, mentions list with delete, **Merge into another object**, delete object — v1.1 §8.2).
- `/app/admin/contributions/page.tsx` (full `raw_input` view, re-run extraction, delete contribution), `/app/admin/queries/page.tsx` (filterable log), `/app/admin/voice-sessions/page.tsx` (v1.2 §8.2: filterable session list, retry transcript fetch, mark abandoned, delete), `/app/admin/prompts/page.tsx` (per-prompt override editor, save/revert).
- `/app/api/admin/...` — admin mutation routes backing all of the above, including the atomic merge server action (v1.1 §8.2: repoint mentions → fold aliases → delete source → re-synthesize target).
- `/components`: `AdminLayout.tsx`, `AdminPasswordGate.tsx`, `AdminObjectEditor.tsx`, `AdminPromptEditor.tsx`, `AdminVoiceSessionsList.tsx`.
- `/docs/v2-deferred.md` — the V2 deferral list from v1.2 §12.
- `/README.md` — operating playbook per v1.2 §10.7: full env-var list, admin playbook (merge, regenerate, delete, re-run extraction, prompt edit, query review, voice-session inspection/retry, threshold tuning), local dev setup including first-run ElevenLabs provisioning, deploy walkthrough (Vercel + Supabase + ElevenLabs).

**Notes:**

- Admin auth is the hardcoded `ADMIN_PASSWORD` gate — no real auth (v1.1 §8.1).
- `README.md` is genuinely last: it documents env vars and crons introduced as late as Phase 6.

**Depends on:** all prior phases.

**Done when:** acceptance criteria #5 and #6 pass: admin can log in, browse/edit objects, regenerate synthesis, delete a mention, re-run extraction, inspect and retry voice sessions, edit/revert prompts, and merge a duplicate object.

---

## File → phase coverage map

Every file in v1.2 §7.1 is assigned to exactly one phase.

| Path                                                         | Phase |
| ------------------------------------------------------------ | ----- |
| `tailwind.config.ts`, `/styles/*`                            | 1     |
| `/supabase/migrations/*`                                     | 2     |
| `lib/supabase.ts`, `lib/llm.ts`, `lib/prompts.ts`, `lib/parsing.ts`, `lib/content.ts` | 2     |
| `/prompts/*` (all 5)                                         | 2     |
| `lib/extraction.ts`, `lib/synthesis.ts`, `lib/chatbar.ts`    | 3     |
| `api/contribute/route.ts`, `api/chat/route.ts`               | 3     |
| `/seeds/*`, `scripts/seed.ts`                                | 4     |
| `app/layout.tsx`, `app/page.tsx`, `app/q/page.tsx`           | 5     |
| `app/{programs,papers,questions,specialists}/page.tsx` + `[slug]` | 5     |
| `app/contribute/page.tsx`, `app/thank-you/page.tsx`          | 5     |
| `TopBar`, `ModeToggle`, `Hero`, `ChatBar`, `ChatResult`, `Citation`, `RefusalState`, `ConfidenceLabel`, `ObjectPage`/`ObjectHeader`/`ObjectBody`/`ObjectFrontmatter`, `IndexList`, `ContributorForm`, `GeneralContributeForm`, `ThankYou` | 5     |
| `lib/elevenlabs.ts`, `scripts/provision-elevenlabs-agents.ts` | 6     |
| `app/voice-interview/page.tsx` + `status/[session_id]/page.tsx` | 6     |
| `api/voice-interview/{start,complete,status}`, `api/cron/voice-sessions-sweep` | 6     |
| `VoiceInterviewForm`, `VoiceInterviewWidget`, `VoiceInterviewStatus` | 6     |
| `docs/elevenlabs-integration.md`                             | 6     |
| `app/admin/*`, `api/admin/*`                                 | 7     |
| `AdminLayout`, `AdminPasswordGate`, `AdminObjectEditor`, `AdminPromptEditor`, `AdminVoiceSessionsList` | 7     |
| `docs/v2-deferred.md`, `README.md`                           | 7     |

## Acceptance-criteria → phase map

Criteria are v1.2 §13.

| Criterion                                | Verifiable after |
| ---------------------------------------- | ---------------- |
| #1 query → cited answer                  | Phase 5          |
| #2 per-page contribution → thank-you     | Phase 5          |
| #3 paste transcript → objects updated    | Phase 5          |
| #4 voice interview end-to-end            | Phase 6          |
| #5 admin operations                      | Phase 7          |
| #6 admin merge duplicate                 | Phase 7          |
| #7 chat-bar clean refusal                | Phase 5          |
| #8 seed script runs                      | Phase 4          |
| #9 provisioning script + integration doc | Phase 6          |

## Cross-cutting concerns

These touch multiple phases; handle them deliberately rather than letting them accrete.

- **`lib/extraction.ts` has three callers.** `/api/contribute` (P5 forms), the voice-completion handler (P6), and the seed script (P4). Define its exported function in P3 to take a pre-inserted `contributions` row id (or raw input + source) so all three share one path.
- **`/contribute` is the universal text fallback.** P5 builds it as the canonical text-contribution page; P6's voice-failure path links to it.
- **`thank-you` is shared.** P5 builds it parameterized by `?contribution_id=`; the voice flow redirects to the same page.
- **`.env.example` grows.** Seeded in P1, extended in P6. `README.md` (P7) documents the final union.
- **Specialists never synthesize.** Enforced in `extraction.ts` (P3, §5.1 step 6) and respected by P4 seed content (stub-only, empty body, no mentions).
- **Prompt overrides.** `prompt_overrides` rows take precedence at runtime everywhere `loadPrompt` is used — the three LLM-call prompts (P3) and the two interviewer prompts (P6).
- **`contributions.raw_input` is source-of-truth** (v1.1 §4 note). Never truncated or overwritten; `mentions` are derived and can be re-extracted. The P7 admin "re-run extraction" action and the P6 voice transcript both rely on this.

## Mockup reconciliation (`practice-commons-draft.html`)

All v1.1 gaps are now closed; the painted-door mockup is in the folder. It is a strong visual and copy reference, but it predates both specs (dated May 21, marked "Draft preview · Illustrative content") and **conflicts with the locked spec in five places**. The spec is authoritative. A coding agent that copies the HTML naively will get all five wrong — Phase 5 must reconcile them:

1. **Object types — the mockup is wrong.** The "What's inside" cards are Programs / Specialists / Papers / **Camps**. The spec's four object types are Programs / Papers / **Questions** / Specialists. Build "Questions," not "Camps." Index routes, the data model, and the seed corpus all use `question`.
2. **Language toggle — drop it.** The mockup's top bar has a prominent person-first / identity-first toggle with placeholder JS. v1.1 §12 and v1.2 §12 both explicitly direct the coding agent to remove it from MVP scope. Do not build it.
3. **Top bar — swap the control.** The mockup's top bar shows a "Draft preview" mark and the language toggle. The MVP top bar instead carries the **Reader / Contributor mode toggle** (v1.1 §6.2 C1) and, in Contributor mode, the "Contribute" and "Start a voice interview" nav entries. Keep the mockup's typographic treatment of the bar; change its contents.
4. **CTA / contributor framing — aspirational, not MVP.** The mockup's "Apply to contribute" button, "membership is reviewed," "contributions are attributed and visible," and the opt-in-attribution commitment section all describe V2 (real auth, contributor records, moderation, attribution control) — none of which exist in MVP. Wire the CTA to the actual MVP path (flip to Contributor mode → `/contribute`), not an application flow. The trust/commitment copy can stay as marketing language, but it must not promise UI affordances the MVP lacks.
5. **Specialists card oversells.** The mockup's Specialists card describes waitlists, referral networks, and peer notes. MVP Specialists are stub-only (factual frontmatter, no body, no peer synthesis). Tone the card copy to MVP reality.

Everything else (synthesis §5.2, chat-bar §5.3, reader/contributor flows §6, design tokens §7.2, responsive §7.4, seed corpus §11) is now fully specified and folded into the phases above. No outstanding inputs.
