# Practice Commons MVP — Design Spec

**Status:** v1.1 — 2026-05-22 (post-observations revisions). Locked for coding-agent implementation.
**Audience:** A coding agent (or human engineer) building the MVP. Some sections also serve as Andrea's playbook.
**Working title for product:** *Practice Commons*. Subject to change post-launch.

---

## 0. Changes from v1

Four surgical revisions made after the v1 observations review:

1. **Seed corpus rebalanced** (§2, §11): 10 Programs / 5 Papers / 5 Questions / 3 Specialists (23 total, up from 20).
2. **Confidence-label threshold made configurable** (§3, §5.2, Appendix A, Appendix B): new env var `WELL_SUPPORTED_THRESHOLD` (default 2). Synthesis prompt reads it as a placeholder. Loosened from v1's hardcoded 3+ to default 2 so claims actually land in the well-supported bucket at MVP corpus sizes.
3. **Complexity-based LLM routing** (§3, Appendix A): `callLLM` accepts an optional `complexity: 1-10` argument. 1-8 routes to Sonnet, 9-10 to Opus. Replaces single `LLM_MODEL` env var with `SONNET_MODEL` + `OPUS_MODEL`. All three production calls assigned explicit complexity (Extraction 5, Synthesis 7, Chat-bar 8). All default to Sonnet; bumping chat-bar to 9 to test Opus is a one-character change.
4. **Admin merge action** (§8.2, §10, §12, §13): proper "Merge into another object" admin action replaces v1's clunky manual-copy-then-delete workflow. One server action: repoint mentions, fold source canonical_name + aliases into target.aliases, delete source row, re-synthesize target.

---

## 1. Purpose & success criteria

Practice Commons is a practitioner-contributed, openly-readable knowledge platform for the autism community. The MVP exists to answer four questions:

1. Do practitioners' eyes light up when shown this resource? Do they immediately have questions they want to ask it?
2. Do practitioners find the object-page presentation useful? How would they improve it?
3. To what extent will practitioners contribute their expertise for free?
4. What opinions on attribution will practitioners have? Are anonymized quotes always OK, or do we need the ability for more?

The MVP is a seeded demo with a live contribution path — practitioners can read, search, and (in Contributor mode) contribute. There is no real authentication, no moderation queue, and no contributor identity tracking. These are deliberate V2 deferrals.

---

## 2. Scope summary

**In MVP:**

- Four object types: Programs, Papers, Questions (full synthesis), and Specialists (stub-only, factual fields, no peer characterization).
- Chat-bar with strict-grounding RAG: whole-corpus-in-context, LLM-generated answer with inline citations, explicit refusal when the corpus doesn't cover the query.
- Contributor mode via top-bar toggle: per-page text contribution + general paste-only entry + voice-interview entry (handing off to Groupstack).
- Append-only mentions log per object + regenerated synthesis with three-tier confidence labels (well-supported / single-source / contested).
- Admin interface at `/admin` with hardcoded password gate; admin can browse, edit object frontmatter, regenerate synthesis, delete mentions or objects, override and clear prompts.
- Seed corpus: ~23 plausible object pages across types, 5 synthetic interview transcripts, ~10 demo queries.

**Out of scope (V2):**

- Real auth, contributor records, per-contributor activity tracking, optional linkage to Specialist records.
- URL paste-in or web-fetch enrichment of contributor profile.
- Member-checking flow (on-demand synthesis preview after submission).
- Moderation queue.
- Full Specialists pages with peer characterizations + subject inform-and-veto workflow.
- Practice-Commons-hosted AI interview (rather than via Groupstack).
- Multi-URL public-trace enrichment.
- Browser voice recording for contributions (Whisper transcription).
- Person-first / identity-first language toggle (deferred).

---

## 3. Architecture

**Tech stack:**

- **Frontend:** Next.js 15+ (App Router) + TypeScript + Tailwind CSS.
- **LLM:** Anthropic SDK (TypeScript). All calls routed through `lib/llm.ts`.
- **Persistence:** Supabase (Postgres + the JS SDK). All runtime writes — contributions, mentions, regenerated synthesis, prompt overrides, queries — go to Postgres. Seed content is loaded from bundled markdown files into Postgres on first deploy.
- **Hosting:** Vercel for the Next.js app; Supabase for the database.
- **Prompts:** five `.md` files in `/prompts/`, imported as raw strings at build time; overrides stored in Postgres take precedence at runtime.

**High-level data flow:**

```
Contribution (per-page / general / voice-interview transcript)
         │
         ▼
  Extraction LLM call ── reads alias index from Postgres
         │
         ▼
  Writes contribution + mentions to Postgres
         │
         ▼
  For each affected object: Synthesis LLM call
         │
         ▼
  Writes regenerated body back to Postgres
         │
         ▼
  Thank-you page lists affected objects + extracted fragments

User query → Chat-bar LLM call (reads ALL object bodies from Postgres) → answer with inline [ref: object-id] citations → renders with sidebar
```

**Three production LLM calls:**

1. **Extraction** (`complexity: 5` → Sonnet): input is contribution text + current alias index; output is structured JSON of extracted mentions. Mechanical structured-output task; Sonnet is well-matched.
2. **Synthesis** (`complexity: 7` → Sonnet): input is one object's frontmatter + all its mentions; output is regenerated body text with confidence labels. Prose quality and rule adherence (operational-not-character, threshold logic, mixed-view preservation) matter more here than for extraction, so positioned higher in the Sonnet band.
3. **Chat-bar** (`complexity: 8` → Sonnet): input is the user's query + concatenated bodies of all objects in the corpus; output is a grounded answer with `[ref: ...]` citations, or a refusal. User-facing quality matters most; sits at the top of the Sonnet band. Bumping to 9 to test Opus is a one-character change if quality demands it during prompt iteration.

All three route through `lib/llm.ts`. Two additional prompts (general and per-page interviewers) are templates that get personalized then handed to Groupstack — they're not invoked from `lib/llm.ts` directly.

**Central LLM wrapper:**

```typescript
// lib/llm.ts (sketch)
export async function callLLM(opts: {
  prompt_name: 'extraction' | 'synthesis' | 'chat-bar' | 'interviewer-general' | 'interviewer-per-page';
  variables: Record<string, string>;     // substituted into the prompt template
  user_message: string;
  complexity?: number;                   // 1-10; defaults to 5. 1-8 → Sonnet, 9-10 → Opus.
  max_tokens?: number;
  temperature?: number;
}): Promise<string>;
```

Behavior:
- Loads the prompt: checks `prompt_overrides` table for `opts.prompt_name`; falls back to bundled `/prompts/<name>.md`.
- Substitutes `{variable_name}` placeholders.
- **Selects the model based on `complexity`** (default 5): values 1-8 use `SONNET_MODEL` (default `claude-sonnet-4-6`); values 9-10 use `OPUS_MODEL` (default `claude-opus-4-7`). The threshold is hardcoded in `lib/llm.ts` and intentionally simple — change the cutoff in one place if the band shifts.
- Calls Anthropic API.
- Retries on transient errors with exponential backoff (max 3 retries).
- Returns the assistant's response text.

---

## 4. Data model (Supabase / Postgres)

```sql
-- Enums
CREATE TYPE object_type AS ENUM ('program', 'paper', 'question', 'specialist');
CREATE TYPE contribution_source AS ENUM ('per_page', 'general', 'voice_interview_callback');

-- Objects: one row per canonical entity
CREATE TABLE objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  type object_type NOT NULL,
  canonical_name TEXT NOT NULL,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,        -- array of strings
  frontmatter JSONB NOT NULL DEFAULT '{}'::jsonb,    -- region, age_range, accepting_new_patients, etc.
  body TEXT NOT NULL DEFAULT '',                     -- synthesized prose with inline [well-supported]/[single-source]/[contested] markers; empty for specialists
  last_synthesized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (type, slug)
);
CREATE INDEX idx_objects_type ON objects (type);
CREATE INDEX idx_objects_canonical_name_lower ON objects (LOWER(canonical_name));

-- Contributions: one row per submission
CREATE TABLE contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source contribution_source NOT NULL,
  raw_input TEXT NOT NULL,                           -- the full submitted text
  page_context_type object_type,                     -- for per_page: which type
  page_context_slug TEXT,                            -- for per_page: which slug
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contributions_created_at ON contributions (created_at DESC);

-- Mentions: one row per (object, contribution) extracted text fragment
CREATE TABLE mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  contribution_id UUID NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  text_fragment TEXT NOT NULL,                       -- the extracted snippet about this object
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mentions_object_id ON mentions (object_id);
CREATE INDEX idx_mentions_contribution_id ON mentions (contribution_id);

-- Prompt overrides: admin-set replacements for the bundled defaults
CREATE TABLE prompt_overrides (
  name TEXT PRIMARY KEY,                             -- 'extraction' | 'synthesis' | 'chat-bar' | 'interviewer-general' | 'interviewer-per-page'
  override_text TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Queries: log of chat-bar queries for admin visibility (CHOIR finding: demand-pattern aggregation)
CREATE TABLE queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  cited_object_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  was_refusal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_queries_created_at ON queries (created_at DESC);
CREATE INDEX idx_queries_was_refusal ON queries (was_refusal);
```

**Notes on the schema:**

- `objects.frontmatter` is JSONB to allow different structured fields per type without rigid columns. For Programs: `{ region, age_range, modality, types_served, ... }`. For Papers: `{ first_author, year, journal, doi, ... }`. For Questions: `{ asker_types, age_range_relevant, ... }`. For Specialists: `{ region, credentials, training, accepting_new_patients, age_range, modalities, ... }`.
- `objects.aliases` is a JSONB array of strings. Used at extraction time to resolve "Child Study Center at NYU" to the existing `nyu-csc` slug. Andrea edits via the admin UI.
- For Specialists, `objects.body` stays empty; the public page renders only frontmatter fields. No mentions are created for Specialists in MVP (no peer synthesis path).
- `queries` is logged from the chat-bar pipeline. Visible only in the admin interface. Drives Andrea's understanding of demand patterns and gaps.
- **`contributions.raw_input` preserves the full submitted text — interview transcript, pasted paragraph, or per-page note — exactly as received.** Never truncated, never overwritten. This is the source-of-truth for everything downstream. The `mentions` rows are derived extractions; if extraction quality improves (via prompt iteration), the same raw input can be re-run against the new prompt without losing the original. Voice-interview transcripts and text-entered contributions all land in this table; the `source` enum distinguishes how they arrived.

---

## 5. Pipelines

### 5.1 Extraction pipeline

**Trigger:** `POST /api/contribute` (called from per-page form, general-contribute form, or voice-interview callback).

**Inputs:**
- `raw_input`: the contribution text.
- `source`: enum value.
- `page_context_type`, `page_context_slug`: only for per-page submissions; gives the extraction model a strong prior that this contribution is about that object.

**Steps:**

1. Insert a row into `contributions` and capture the `id`.
2. Load the alias index: `SELECT id, type, slug, canonical_name, aliases FROM objects;`. Format as a compact list for the LLM.
3. Call extraction LLM (`lib/llm.ts` with `prompt_name: 'extraction'`, `complexity: 5`).
   - Variables: `{alias_index}`, `{page_context}` (formatted slug/type or "none").
   - User message: `raw_input`.
4. Parse the JSON response. Expected shape:
   ```json
   {
     "mentions": [
       {
         "target_slug": "nyu-csc",         // existing slug, OR null if is_new
         "type": "program",
         "is_new": false,
         "canonical_name_if_new": null,
         "text_fragment": "Reports a 3-month intake delay as of spring 2026..."
       },
       ...
     ]
   }
   ```
5. For each mention:
   - If `is_new`: `INSERT INTO objects (type, slug, canonical_name) VALUES (...)`. Generate the slug as a kebab-case version of `canonical_name_if_new`, with collision handling (append `-2`, `-3`, etc.).
   - Insert a `mentions` row referencing the contribution and the object.
6. Collect the set of affected `object_id`s. For each one whose `type` is not `specialist`, run the synthesis pipeline (see 5.2).
7. Return to the client: list of `{ id, type, slug, canonical_name, text_fragment }` for the thank-you page.

**Failure modes:**
- LLM returns malformed JSON: retry once, then commit the contribution with zero mentions and surface "we couldn't extract anything from this — the contribution was saved but didn't update any pages" to the contributor.
- LLM proposes a new canonical name that looks like a near-match to an existing one: the LLM is instructed in the extraction prompt to prefer existing matches; rare false-positives get cleaned up by Andrea via the admin merge workflow.

### 5.2 Synthesis pipeline

**Trigger:** any contribution producing ≥1 extracted object-mention for a non-specialist object; also exposed via admin "Regenerate" button.

**Inputs:**
- `object_id`: the object whose body is being regenerated.

**Steps:**

1. Load the object: `SELECT type, canonical_name, frontmatter, aliases FROM objects WHERE id = $1;`.
2. Load all its mentions in chronological order: `SELECT text_fragment, created_at FROM mentions WHERE object_id = $1 ORDER BY created_at ASC;`.
3. Call synthesis LLM (`lib/llm.ts` with `prompt_name: 'synthesis'`, `complexity: 7`).
   - Variables: `{object_name}`, `{object_type}`, `{frontmatter_json}`, `{mentions_block}` (formatted as numbered fragments), `{well_supported_threshold}` (read from env var `WELL_SUPPORTED_THRESHOLD`, default `"2"`).
   - User message: standard synthesis instruction (in the prompt template).
4. Update the object: `UPDATE objects SET body = $1, last_synthesized_at = now() WHERE id = $2;`.

**Synthesis output format:**
- Plain prose, 1-3 paragraphs.
- Inline confidence labels wrap claims:
  - `[well-supported]` — at least `WELL_SUPPORTED_THRESHOLD` mentions agree (default: 2).
  - `[single-source]` — only 1 mention supports the claim, no corroboration.
  - `[contested]` — multiple mentions, mixed views.
- The threshold is configurable via env var so Andrea can tune it as the corpus grows. Default of 2 is deliberately loose at MVP scale — with a small corpus, requiring 3+ agreeing mentions would leave almost nothing in the well-supported bucket. Raise it later once mention density supports it.
- Example fragment: `"NYU CSC is widely regarded as a top evaluator for adolescents [well-supported]. Recent contributors note 3-6 month intake delays [single-source]. Views on insurance acceptance are mixed [contested]."`
- The frontend parses these markers into visual badges.

**Synthesis rules (baked into the prompt):**
- Cite only what's in the provided mentions. No outside knowledge.
- Preserve mixed views rather than smooth them.
- Operational, not characterological. Even though Specialists are stub-only in MVP, the synthesis prompt encodes the operational-not-character rule for V2 use — keep it in the prompt.
- If mentions are sparse or only one fragment exists, the synthesis should reflect that, not paper over it.

### 5.3 Chat-bar pipeline

**Trigger:** `POST /api/chat` with `{ query_text }`.

**Steps:**

1. Load all objects with non-empty bodies: `SELECT type, slug, canonical_name, body FROM objects WHERE body != '' ORDER BY type, slug;`.
   - For MVP corpus size, this is ~30-100 rows totaling ~15-75K tokens. Comfortably fits in one Sonnet 4.6 context window.
2. Format the corpus as concatenated text blocks, each prefixed with `## ref: <type>/<slug> — <canonical_name>`.
3. Call chat-bar LLM (`lib/llm.ts` with `prompt_name: 'chat-bar'`, `complexity: 8`).
   - Variables: `{corpus_block}`.
   - User message: `query_text`.
4. Parse the response. The LLM returns prose with inline `[ref: <type>/<slug>]` markers, OR a refusal phrase like *"The bin doesn't cover this yet."*
5. Extract unique cited slugs from the answer text.
6. Look up cited objects: `SELECT id, type, slug, canonical_name FROM objects WHERE (type, slug) IN (...);`.
7. Insert a row in `queries` (for admin visibility).
8. Return `{ answer_text, cited_objects: [...], was_refusal: bool }` to the client.

**Chat-bar prompt rules (baked into the prompt):**
- Answer ONLY from the provided corpus. No outside knowledge ever.
- Cite inline with `[ref: <type>/<slug>]` for each substantive claim.
- If the corpus doesn't contain relevant information, respond exactly: *"The bin doesn't cover this yet. If you have knowledge of this, please contribute via the Contribute link."* (or similar canonical refusal language defined in the prompt).
- Tone: knowledgeable colleague. Direct, specific. Willing to say "it depends" and "contributors disagree."
- Length: 1-4 paragraphs. No padding.

### 5.4 Voice-interview personalization

**Trigger:** `POST /api/voice-interview/start` from the `/voice-interview` page.

**Inputs:**

- `expertise_text`: optional, possibly empty.

**Steps:**

1. Load the `interviewer-general` prompt (override or default via `lib/llm.ts` loader; do NOT call the LLM).
2. Substitute `{contributor_expertise}` with `expertise_text` if non-empty, else with an empty-state phrase like *"(no expertise context provided)"*.
3. Call Groupstack: `POST {GROUPSTACK_API_URL}/api/interview/start` with `{ prompt: <personalized>, callback_url: <PRACTICE_COMMONS_HOST>/api/voice-interview/callback }`. (See Groupstack contract document.)
4. Receive `{ session_url }` from Groupstack.
5. Redirect the user to `session_url`.

**Fallback** (if Groupstack API isn't yet available): the page displays the personalized prompt in a read-only textarea with a "Copy prompt" button, plus a static link to Groupstack's regular interface. Selectable via env var `GROUPSTACK_API_AVAILABLE` (default: false at MVP launch).

**Callback:**
- `POST /api/voice-interview/callback` receives `{ session_id, transcript, status }` from Groupstack.
- If `status === 'completed'`, the transcript is committed as a `contributions` row with `source = 'voice_interview_callback'` and run through the standard extraction pipeline. No user is in the loop at this point; the resulting page updates happen asynchronously.

---

## 6. User flows

### 6.1 Reader flows

**R1 — Landing.** User visits `/`. Sees: masthead with Practice Commons title and tagline, Reader/Contributor toggle in top bar (Reader default), chat-bar centered prominently, suggested-query chips below, brief premise section, links to typed index pages.

**R2 — Asking via chat-bar.** User types a query, hits Enter or clicks "Ask." Loading state. Redirect to `/q?query=<urlencoded>`. The result page renders the synthesized answer at top with inline `[ref: ...]` markers parsed into clickable spans, a sidebar listing each unique cited object with a link to its page, and the query preserved in the URL. On refusal: the answer area shows the refusal text and an inline CTA *"If you can help with this, contribute"* linking to `/contribute`.

**R3 — Object page.** Reached via citation click, direct URL, or index page. Renders frontmatter as a structured header (whichever fields are populated), then the synthesized body prose with confidence-label badges parsed from inline markers, then a "Last updated: <timestamp>" footer. Specialists pages render frontmatter only — no body, no contribute affordance. Reader mode shows no contribution affordance even on full-synthesis types.

**R4 — Index pages.** `/programs`, `/papers`, `/questions`, `/specialists` each list all objects of that type. Sorted alphabetically by `canonical_name` by default; a toggle for "by last updated" is a nice-to-have but not required.

### 6.2 Contributor flows

**C1 — Mode toggle.** Top-bar selector flips Reader → Contributor. No identification, no session, no persistence. State held in a simple cookie or URL hash for the session. In Contributor mode: the per-page contribute affordance becomes visible on non-Specialist object pages, and the top nav adds "Contribute" and "Start a voice interview" entries.

**C2 — Per-page contribute.** On any Programs / Papers / Questions page in Contributor mode, a section opens: *"Add your thoughts about [object-name]."* Single textarea + Submit button. On submit → `POST /api/contribute` with `source = 'per_page'`, `page_context_type` and `page_context_slug` set → redirect to `/thank-you?contribution_id=<id>`.

**C3 — General contribute.** Top-nav "Contribute" link in Contributor mode → `/contribute` page with one large textarea: *"Paste a transcript, notes, or general thoughts. The system extracts mentions of programs, papers, and questions, and adds them to the relevant pages."* On submit → `POST /api/contribute` with `source = 'general'` → redirect to thank-you.

**C4 — Voice interview entry.** Top-nav "Start a voice interview" link in Contributor mode → `/voice-interview` page with: an optional textarea (*"Optional — tell us a few words about your specialty so we can tailor the questions. Leave blank, type a few words, or paste a chunk of text."*) + "Start interview" button. On submit → `POST /api/voice-interview/start` → either redirected to Groupstack (if API available) or shown the personalized prompt to copy manually (fallback).

**C5 — Voice interview return.** After the Groupstack interview, the contributor either receives an automatic callback (handled server-side) or returns to Practice Commons manually and pastes the transcript into `/contribute`. No additional UI needed; the existing general-contribute flow handles it.

**C6 — Thank-you.** `/thank-you?contribution_id=<id>` shows: *"Thanks. Your input updated:"* followed by a list of `{ canonical_name, type, slug, text_fragment }` retrieved by joining the contribution's mentions to objects. Each affected object is a link to its page. Below: a one-line preview of the extracted fragment per object (the `text_fragment` from `mentions`, not the regenerated synthesis — cheap, no diffing required). At the bottom: *"Looks off? Let us know"* → `mailto:` link to Andrea's email (configurable via env var `FEEDBACK_EMAIL`).

### 6.3 Admin flows

See Section 8.

---

## 7. Frontend specification

### 7.1 File layout

```
/app
  layout.tsx
  page.tsx                              # home: masthead, chat-bar, premise
  q/page.tsx                            # chat-bar results
  programs/page.tsx                     # index
  programs/[slug]/page.tsx              # object page (full synthesis)
  papers/page.tsx
  papers/[slug]/page.tsx
  questions/page.tsx
  questions/[slug]/page.tsx
  specialists/page.tsx
  specialists/[slug]/page.tsx           # stub-only render
  contribute/page.tsx                   # general contribute
  voice-interview/page.tsx              # optional expertise + start
  thank-you/page.tsx                    # affected objects + extraction preview
  admin/
    layout.tsx                          # password gate
    page.tsx                            # admin index
    object/[type]/[slug]/page.tsx       # admin object editor
    contributions/page.tsx              # contributions log
    queries/page.tsx                    # queries log
    prompts/page.tsx                    # prompt library editor
  api/
    contribute/route.ts                 # POST: extraction → mentions → synthesis
    chat/route.ts                       # POST: chat-bar pipeline
    voice-interview/
      start/route.ts                    # POST: personalize + Groupstack handoff
      callback/route.ts                 # POST: Groupstack callback
    admin/
      ...                               # admin mutations
/components
  TopBar.tsx, ModeToggle.tsx
  Hero.tsx, ChatBar.tsx, ChatResult.tsx, Citation.tsx, RefusalState.tsx
  ConfidenceLabel.tsx
  ObjectPage.tsx, ObjectHeader.tsx, ObjectBody.tsx, ObjectFrontmatter.tsx
  IndexList.tsx
  ContributorForm.tsx, GeneralContributeForm.tsx, VoiceInterviewForm.tsx
  ThankYou.tsx
  AdminLayout.tsx, AdminPasswordGate.tsx, AdminObjectEditor.tsx, AdminPromptEditor.tsx
/lib
  llm.ts                                # central Anthropic SDK wrapper
  supabase.ts                           # Supabase client (server-side)
  content.ts                            # high-level content access (load objects, write mentions, etc.)
  extraction.ts                         # extraction pipeline
  synthesis.ts                          # synthesis pipeline
  chatbar.ts                            # chat-bar pipeline
  prompts.ts                            # prompt loader (DB override → bundled default)
  groupstack.ts                         # Groupstack API client
  parsing.ts                            # parse [ref: ...] and confidence markers
/prompts
  extraction.md
  synthesis.md
  chat-bar.md
  interviewer-general.md                # contains {contributor_expertise} placeholder
  interviewer-per-page.md               # contains {object_context} placeholder
/styles
  tokens.css                            # CSS variables extracted from painted-door
  globals.css
/tailwind.config.ts                     # maps utilities to tokens
/seeds
  README.md                             # describes how to seed
  interviews/                           # 5 synthetic interview transcripts
    01.md, 02.md, 03.md, 04.md, 05.md
  initial-objects/                      # ~23 plausible object scaffolds
    programs/, papers/, questions/, specialists/
  queries.md                            # ~10 demo queries
/scripts
  seed.ts                               # imports /seeds/ into Supabase on first deploy
/docs
  groupstack-contract.md                # separate contract doc for the Groupstack agent
  v2-deferred.md                        # the full V2/deferred list
README.md                               # operating playbook
```

### 7.2 Design tokens (extracted from the painted-door HTML)

```css
/* /styles/tokens.css */
:root {
  --bg: #F7F3EA;
  --bg-elev: #FFFCF4;
  --ink: #1E1A14;
  --ink-soft: #4A4138;
  --muted: #7A6F61;
  --rule: #D9D1BF;
  --rule-soft: #E8E1D2;
  --accent: #7A3220;
  --accent-soft: #C66B4B;
  --tag-bg: #EFE8D6;

  --font-display: 'Fraunces', Georgia, 'Times New Roman', serif;
  --font-body: 'Source Serif 4', Georgia, serif;

  --space-1: 0.5rem;
  --space-2: 1rem;
  --space-3: 1.5rem;
  --space-4: 2rem;
  --space-5: 3rem;
  --space-6: 4rem;

  --radius-sm: 2px;
  --radius-md: 4px;
}
```

`tailwind.config.ts` maps these to utility classes (`bg-accent`, `text-ink`, `font-display`, `space-y-4`, etc.) so components don't reference raw hex values. To restyle, edit `tokens.css`.

### 7.3 Component conventions

- All components consume tokens via Tailwind utilities or via direct `var(--token)` references. No hardcoded color or font values inside component files.
- Components are typed (props interface for each). No prop-spreading or untyped refs.
- Layout components are server components by default; client components are explicit (`'use client'`) and minimized to what needs interactivity (forms, the chat-bar input, the admin editors).
- Confidence-label parsing happens in `lib/parsing.ts` and yields a structured representation (`{ text_chunks: [ { text, label?: ConfidenceLevel } ] }`) consumed by `ObjectBody.tsx`. Same pattern for `[ref: ...]` parsing in `ChatResult.tsx`.

### 7.4 Responsive

- Painted-door HTML's existing breakpoints (900px, 560px) carry over.
- Chat-bar collapses to vertical stack on mobile.
- Card grid on the home page collapses to 2-up, then 1-up.

---

## 8. Admin interface

### 8.1 Auth

- Hardcoded password gate. Password configured via env var `ADMIN_PASSWORD` (default for MVP: `"andrea"`).
- On first visit to any `/admin/*` route: redirect to `/admin/login`. User enters password. Correct password sets a signed cookie (Next.js middleware or simple session cookie); subsequent requests check the cookie.
- This is not real authentication. Anyone with the password URL has full edit access. Documented explicitly in the README as MVP-only. A V2 deferral note covers replacement with real auth.

### 8.2 Admin pages

**`/admin` (index).** Lists all objects, grouped by type. Each row: canonical name, slug, mention count (or "stub" for Specialists), last-synthesized timestamp. Click into an object to edit.

**`/admin/object/[type]/[slug]`.** The object editor.

- **Frontmatter editor.** Each field in `objects.frontmatter` rendered as an editable input. Plus editable fields for `canonical_name` and `aliases` (textarea, one alias per line). "Save" button writes via `UPDATE objects SET ... WHERE id = $1`.
- **Synthesis view.** Read-only text of `objects.body`. "Regenerate synthesis" button triggers the synthesis pipeline for this object on demand.
- **Mentions list.** All mentions for this object, chronological. Each shows `text_fragment`, source contribution timestamp, and a "Delete this mention" button. Deleting cascades to re-running synthesis.
- **Merge into another object.** A button that opens a picker showing other objects of the same type (filtered list with search). On confirm, a single server action executes atomically:
  1. `UPDATE mentions SET object_id = <target_id> WHERE object_id = <source_id>` — repoint all mentions.
  2. `UPDATE objects SET aliases = aliases || <source.canonical_name> || <source.aliases> WHERE id = <target_id>` — fold source canonical name and aliases into target's alias list (deduplicated).
  3. `DELETE FROM objects WHERE id = <source_id>` — remove the source row.
  4. Trigger synthesis pipeline for the target object so its body reflects the merged mention set.
  
  Used whenever the extraction LLM created a duplicate ("NYU Child Study Center" + "NYU CSC"). This is the primary entity-resolution cleanup tool — expect Andrea to use it routinely. Confirmation modal shows source name, target name, and mention counts before executing.
- **Delete object.** A separate button (with confirmation) that removes the object and all its mentions. Used when a contribution was junk or an object was created in error and has no canonical equivalent to merge into. Distinct from merge: deletes mentions rather than repointing them.

**`/admin/contributions`.** Chronological list of all contributions across the corpus. List view shows: timestamp, source, first ~100 chars of `raw_input`, count of affected objects. Click into any row to see the **full `raw_input` text** (the entire interview transcript or pasted contribution), the list of affected objects with their extracted fragments, metadata (time/date), custom qualifications entered, and two actions:

- **Re-run extraction.** Deletes the existing `mentions` rows for this contribution, re-runs the extraction pipeline against the stored `raw_input` (picking up any prompt overrides since the original run), and regenerates synthesis on affected objects. Useful after iterating the extraction prompt — Andrea can replay prior contributions against the improved prompt to test it and to upgrade the existing corpus.
- **Delete contribution.** Removes the contribution and cascades to all its mentions; affected objects get re-synthesized from their remaining mentions. Used when a contribution was junk or was committed in error.

**`/admin/queries`.** Chronological list of all chat-bar queries. Filters: "all" / "refusals only" / "answered." Used to spot demand patterns and gaps in the corpus.

**`/admin/prompts`.** The prompt library.

- One section per prompt: `extraction`, `synthesis`, `chat-bar`, `interviewer-general`, `interviewer-per-page`.
- Each section shows:
  - Current effective text in a large `<textarea>`. If a row exists in `prompt_overrides` for this name, the textarea contains the override. Else, it contains the bundled default.
  - A small indicator: "Currently: bundled default" or "Currently: override (last edited <timestamp>)."
  - "Save override" button → `INSERT INTO prompt_overrides ... ON CONFLICT (name) DO UPDATE`.
  - "Revert to default" button → `DELETE FROM prompt_overrides WHERE name = $1`.

The `lib/prompts.ts` loader:

```typescript
export async function loadPrompt(name: PromptName): Promise<string> {
  const { data } = await supabase
    .from('prompt_overrides')
    .select('override_text')
    .eq('name', name)
    .maybeSingle();
  if (data?.override_text) return data.override_text;
  return BUNDLED_PROMPTS[name];   // imported as raw strings from /prompts/*.md
}
```

---

## 9. Groupstack integration

Practice Commons hands off voice interviews to Groupstack and receives transcripts back. The contract is defined in a separate document, `/docs/groupstack-contract.md`, intended to be shared with the Groupstack coding agent.

**Summary of what Practice Commons does:**

- Generates a personalized version of `interviewer-general.md` by substituting the optional expertise text.
- Calls `POST {GROUPSTACK_API_URL}/api/interview/start` with `{ prompt, callback_url }` (if `GROUPSTACK_API_AVAILABLE=true`).
- Redirects user to the returned `session_url`.
- Accepts callback at `POST /api/voice-interview/callback` with `{ session_id, transcript, status }`.
- Commits the transcript as a contribution and runs the standard extraction pipeline.

**Fallback if API isn't available at MVP launch:** display the personalized prompt with a Copy button and a link to Groupstack; user pastes prompt into Groupstack manually, then later returns and pastes the transcript into `/contribute`.

---

## 10. Deliverables

The coding agent produces:

1. **Application code** per the file layout in §7.1.
2. **Five prompts in `/prompts/`:**
   - `extraction.md` — extracts structured mentions JSON given contribution text + alias index + optional page context.
   - `synthesis.md` — regenerates an object's body from frontmatter + mentions; uses inline `[well-supported]` / `[single-source]` / `[contested]` markers; encodes the operational-not-character rule (for V2 Specialists; kept in MVP prompt). Contains `{well_supported_threshold}` placeholder for the configurable threshold (default 2).
   - `chat-bar.md` — answers from corpus only; cites with `[ref: <type>/<slug>]`; refuses cleanly when corpus is uncovered; tone of knowledgeable colleague.
   - `interviewer-general.md` — template with `{contributor_expertise}` placeholder; opens with FAQ-first question ("what three questions do you get asked most often"), uses follow-ups to draw out programs/papers/specifics.
   - `interviewer-per-page.md` — template with `{object_context}` placeholder; scoped questions about that one object.
3. **Token files:** `tokens.css` + `tailwind.config.ts` derived from the painted-door HTML.
4. **Seed corpus scaffolding:** see §11.
5. **Database setup:**
   - SQL migration file in `/supabase/migrations/` matching §4.
   - Seeding script (`/scripts/seed.ts`) that runs the SQL migration, then imports `/seeds/` content. Idempotent (safe to re-run).
6. **`README.md` operating playbook:**
   - Environment variable list and explanations: `ANTHROPIC_API_KEY`, `ADMIN_PASSWORD`, `SONNET_MODEL`, `OPUS_MODEL`, `WELL_SUPPORTED_THRESHOLD`, `GROUPSTACK_API_URL`, `GROUPSTACK_API_AVAILABLE`, `FEEDBACK_EMAIL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
   - Andrea's playbook: merging duplicate objects (admin UI walk-through of the Merge action — picker, confirmation, what gets repointed), regenerating synthesis manually, deleting mentions or junk objects, editing prompts, viewing queries, adjusting the well-supported threshold.
   - Local dev setup: clone, install, set env vars, run Supabase locally or point at a remote project, run `pnpm seed`, then `pnpm dev`.
   - Deploy walkthrough: Vercel + Supabase wiring.
7. **`/docs/groupstack-contract.md`** — standalone contract doc.
8. **`/docs/v2-deferred.md`** — the V2 deferral list.

---

## 11. Seed corpus

The coding agent ships:

- **~23 plausible object pages** distributed across types:
  - 10 Programs (e.g., schools, IOPs, social skills groups, day treatment, named plausibly — *"Westside Behavioral Day Program," "Riverview Social Skills Clinic,"* etc.)
  - 5 Papers (plausible-sounding titles, fictional authors, realistic-sounding abstracts)
  - 5 Questions (e.g., *"How do I find a good evaluator for a high-masking teen girl?"*, *"My pediatrician sees signs in a 3-year-old — what do I do next?"*)
  - 3 Specialists (stub-only, factual fields populated, no body)
- **5 synthetic interview transcripts** in `/seeds/interviews/`. Plausible content, varied formats. The seeding script runs each through the extraction pipeline to populate mentions and synthesis on the initial objects. (Synthetic interview content should mention the seeded objects by name, plus introduce 2-3 new objects per transcript so the new-object pipeline gets tested.)
- **~10 demo queries** in `/seeds/queries.md`. The coding agent should verify (manually or via a smoke test in `/scripts/`) that each query hits gracefully against the seeded corpus — produces a substantive, well-cited answer rather than a refusal.

The seed corpus is content the coding agent generates plausibly; Andrea and the user replace it with real content over time.

---

## 12. Open items and V2 deferred

### Known open items at MVP launch

- **Groupstack API surface unknown.** The contract in `/docs/groupstack-contract.md` is what Practice Commons assumes; the Groupstack coding agent may implement a different shape. Update both sides if so. The fallback path (env var `GROUPSTACK_API_AVAILABLE=false`) lets MVP ship even if Groupstack isn't ready.
- **Entity resolution edge cases.** The extraction LLM will sometimes create duplicate objects under near-identical canonical names. Andrea uses the admin Merge action (§8.2) to fold a duplicate into its canonical match — one click repoints mentions, folds aliases, and re-synthesizes. Expect ~10-20% duplicate creation rate at MVP scale; will improve as the alias index grows and merge events feed back into it.
- **Prompt-engineering quality.** The five prompts are first drafts. Expect ~2-3 iterations on each before the demo experience is solid. The prompt library admin page is the iteration surface; default texts can also be edited in `/prompts/` and committed for source-controlled history.
- **Person-first / identity-first language toggle.** The painted-door HTML includes a top-bar toggle; MVP ships it as a non-functional placeholder OR removes it. The coding agent should remove it from MVP scope to avoid an obvious broken affordance.

### V2 / deferred (full list)

- Contributor records (top V2 priority): soft self-identification, profile records, activity tracking, optional linkage to Specialist records, expertise URL paste-in with fetch + extraction.
- Per-contributor analytics (questions asked, mentions made).
- Member-checking flow: on-demand synthesis preview after submission, *"here's what the page would look like with your input — confirm we got it right."*
- Moderation queue for contributions before they go live.
- Full Specialists pages with peer characterizations; subject inform-and-veto workflow.
- Real authentication replacing the `/admin` password gate and adding identified contributors.
- Practice-Commons-hosted AI interview (replacing or supplementing Groupstack handoff).
- Multi-URL public-trace enrichment of contributor profiles (the original thought-exercise idea).
- Browser voice recording for contributions (Whisper transcription).
- Person-first / identity-first language toggle.
- Visible version history per object with "what changed" summaries per update.
- More sophisticated retrieval (vector embeddings, BM25 pre-filter) when corpus exceeds ~75K tokens.
- Topic-specific update cadence (programs with active leadership changes update faster than stable papers).
- Member-checking at scale.

---

## 13. Acceptance criteria for MVP build

The coding agent's build is complete when:

1. A user can visit the deployed site, type a query, and receive a grounded answer with at least one citation linking to a seeded object page.
2. A user can toggle to Contributor mode, submit a contribution via the per-page form on any non-Specialist object, and see a thank-you page listing the affected objects with extracted fragments.
3. A user can paste a transcript into `/contribute` and see one or more objects updated (new mentions added, synthesis regenerated).
4. A user can visit `/voice-interview`, optionally enter expertise text, click "Start interview," and either (a) be redirected to Groupstack with a personalized prompt or (b) see the personalized prompt with a Copy button (fallback).
5. Andrea can log into `/admin` with the configured password, browse all objects, edit aliases on an object, regenerate its synthesis, delete a mention, view a contribution's full raw text and re-run extraction on it, and edit/revert a prompt override.
6. Andrea can merge a duplicate object into its canonical match via the admin Merge action: select source object, pick target from the same-type picker, confirm, and verify (a) the source object is deleted, (b) its mentions now point to the target, (c) the source's canonical name and aliases have been folded into the target's alias list, and (d) the target has been re-synthesized.
7. The chat-bar refuses cleanly (with the canonical refusal phrase) when asked a question the corpus doesn't cover — verified by running a known out-of-corpus query.
8. The seed script (`pnpm seed`) runs end-to-end on a fresh Supabase project and populates the corpus with all ~23 seed objects plus mentions from the 5 synthetic interviews.
9. The Groupstack contract document at `/docs/groupstack-contract.md` is complete and readable as a standalone document.

---

## Appendix A: Key environment variables

```bash
# LLM
ANTHROPIC_API_KEY=...
SONNET_MODEL=claude-sonnet-4-6             # used for callLLM complexity 1-8 (default)
OPUS_MODEL=claude-opus-4-7                 # used for callLLM complexity 9-10

# Synthesis
WELL_SUPPORTED_THRESHOLD=2                 # min mentions agreeing for [well-supported] label; raise as corpus grows

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...              # server-side only, never exposed to client

# Admin
ADMIN_PASSWORD=andrea                      # change in production

# Groupstack
GROUPSTACK_API_URL=https://groupstack.example.com
GROUPSTACK_API_AVAILABLE=false             # set to true when the Groupstack coding agent ships the API
PRACTICE_COMMONS_HOST=https://practicecommons.example.com   # used for callback URL

# Feedback
FEEDBACK_EMAIL=andrea@practicecommons.example.com
```

---

## Appendix B: Glossary

- **Object.** A canonical record about a Program, Paper, Question, or Specialist. One row in `objects`.
- **Mention.** An extracted text fragment about an object, derived from a contribution. One row in `mentions`.
- **Contribution.** A submission from a contributor — per-page, general, or voice-interview transcript callback. One row in `contributions`.
- **Synthesis.** The regenerated body text of an object, produced by the synthesis LLM call from all mentions of that object.
- **Confidence label.** One of `well-supported` / `single-source` / `contested`, inline-marked in synthesis output, rendered as a badge. `well-supported` requires ≥ `WELL_SUPPORTED_THRESHOLD` agreeing mentions (default 2, configurable via env var).
- **Citation.** An inline `[ref: <type>/<slug>]` marker in chat-bar output, rendered as a clickable link to the cited object.
- **Refusal.** The chat-bar's response when the corpus doesn't cover the query. Standardized phrasing per the chat-bar prompt.
- **Alias.** A non-canonical name that should resolve to the same object as the canonical name. Stored in `objects.aliases`.
