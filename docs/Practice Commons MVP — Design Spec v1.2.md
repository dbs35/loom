# Practice Commons MVP — Design Spec

**Status:** v1.2 — 2026-05-22 (voice integration revised to direct ElevenLabs). Locked for coding-agent implementation. Audience: A coding agent (or human engineer) building the MVP. Working title for product: Practice Commons. Subject to change post-launch.

## 0. Changes from v1.1

Voice integration approach swapped: Practice Commons now embeds an ElevenLabs conversational agent **directly** rather than delegating to Groupstack.

1. **§2, §3, §5.4, §6.2, §7.1, §9, Appendix A** updated to reflect ElevenLabs-direct integration. Two ElevenLabs agents (one "general," one "per-page") are pre-provisioned with `overrides` enabled, and Practice Commons passes per-session `system_prompt` + `first_message` overrides at session start. The voice interview runs entirely in the contributor's browser inside Practice Commons; no third-party redirect.
2. **§4** gains a `voice_sessions` table to track in-progress interviews and resolve the conversation→contribution handoff atomically once the transcript is ready.
3. **§4** `contribution_source` enum value `voice_interview_callback` renamed to `voice_interview` (no callback anymore).
4. **§5.4** transcript fetching uses fast retry (~14s) + background retry via Next's `after()` (~8 min), borrowing Groupstack's proven resilience pattern at a lighter touch.
5. **§7.1** replaces `lib/groupstack.ts` with `lib/elevenlabs.ts` and adds `components/VoiceInterviewWidget.tsx`. The `/voice-interview` page now hosts the widget directly; there is no longer a "copy prompt + go elsewhere" fallback path.
6. **§9** is now filled in with the ElevenLabs integration contract (agent provisioning, override schema, transcript retrieval).
7. **§12, §13, Appendix A** updated: Groupstack open items removed; ElevenLabs operational notes added; acceptance criterion #4 reframed around the embedded widget.

Surgical revisions from v1.0 retained: rebalanced seed corpus (23 objects), configurable `WELL_SUPPORTED_THRESHOLD`, complexity-based LLM routing, admin merge action.

## 1. Purpose & success criteria

*(unchanged from v1.1)*

Practice Commons is a practitioner-contributed, openly-readable knowledge platform for the autism community. The MVP exists to answer four questions:

1. Do practitioners' eyes light up when shown this resource? Do they immediately have questions they want to ask it?
2. Do practitioners find the object-page presentation useful? How would they improve it?
3. To what extent will practitioners contribute their expertise for free?
4. What opinions on attribution will practitioners have? Are anonymized quotes always OK, or do we need the ability for more?

The MVP is a seeded demo with a live contribution path — practitioners can read, search, and (in Contributor mode) contribute. There is no real authentication, no moderation queue, and no contributor identity tracking. These are deliberate V2 deferrals.

## 2. Scope summary

**In MVP:**

- Four object types: Programs, Papers, Questions (full synthesis), and Specialists (stub-only, factual fields, no peer characterization).
- Chat-bar with strict-grounding RAG: whole-corpus-in-context, LLM-generated answer with inline citations, explicit refusal when the corpus doesn't cover the query.
- Contributor mode via top-bar toggle: per-page text contribution + general paste-only entry + **in-browser voice interview powered by an embedded ElevenLabs agent**.
- Append-only mentions log per object + regenerated synthesis with three-tier confidence labels (well-supported / single-source / contested).
- Admin interface at `/admin` with hardcoded password gate; admin can browse, edit object frontmatter, regenerate synthesis, delete mentions or objects, override and clear prompts, and inspect voice sessions.
- Seed corpus: ~23 plausible object pages across types, 5 synthetic interview transcripts, ~10 demo queries.

**Out of scope (V2):**

- Real auth, contributor records, per-contributor activity tracking, optional linkage to Specialist records.
- URL paste-in or web-fetch enrichment of contributor profile.
- Member-checking flow (on-demand synthesis preview after submission).
- Moderation queue.
- Full Specialists pages with peer characterizations + subject inform-and-veto workflow.
- Multi-URL public-trace enrichment.
- Browser voice recording for **text** contributions (Whisper transcription).
- Person-first / identity-first language toggle (deferred).
- Multi-session voice interviews (each MVP session is single-session; if a contributor reconnects, a new session is created).
- Pause/resume on voice interviews (basic stop/restart only).

## 3. Architecture

**Tech stack:**

- **Frontend:** Next.js 15+ (App Router) + TypeScript + Tailwind CSS.
- **LLM:** Anthropic SDK (TypeScript). All calls routed through `lib/llm.ts`.
- **Voice:** ElevenLabs Conversational AI (`@elevenlabs/react` for the browser-side widget; ElevenLabs REST API server-side for signed URL minting and transcript retrieval). Two pre-provisioned agents, configured with `system_prompt` and `first_message` overrides enabled.
- **Persistence:** Supabase (Postgres + the JS SDK). All runtime writes — contributions, mentions, regenerated synthesis, prompt overrides, queries, voice sessions — go to Postgres. Seed content is loaded from bundled markdown files into Postgres on first deploy.
- **Hosting:** Vercel for the Next.js app; Supabase for the database.
- **Prompts:** five `.md` files in `/prompts/`, imported as raw strings at build time; overrides stored in Postgres take precedence at runtime.

**High-level data flow:**

```
Text contribution (per-page or general paste)
         │
         ▼
  Extraction LLM call ──── reads alias index from Postgres
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

Voice contribution
         │
         ▼
  /voice-interview page renders ElevenLabs widget with per-session prompt override
         │
         ▼
  Browser conducts voice interview; conversation_id captured
         │
         ▼
  On end: client POSTs { session_id, conversation_id } to /api/voice-interview/complete
         │
         ▼
  Server fetches transcript from ElevenLabs (fast retry, then background retry)
         │
         ▼
  Transcript becomes a contributions row (source = 'voice_interview')
         │
         ▼
  Same extraction → mentions → synthesis pipeline as text contributions
         │
         ▼
  Thank-you page (or polled status if transcript still pending)

User query → Chat-bar LLM call (reads ALL object bodies from Postgres) → answer with inline [ref: object-id] citations → renders with sidebar
```

**Three production LLM calls:**

1. **Extraction** (`complexity: 5` → Sonnet): input is contribution text + current alias index; output is structured JSON of extracted mentions. Mechanical structured-output task; Sonnet is well-matched.
2. **Synthesis** (`complexity: 7` → Sonnet): input is one object's frontmatter + all its mentions; output is regenerated body text with confidence labels. Prose quality and rule adherence matter more here, so positioned higher in the Sonnet band.
3. **Chat-bar** (`complexity: 8` → Sonnet): input is the user's query + concatenated bodies of all objects in the corpus; output is a grounded answer with `[ref: ...]` citations, or a refusal. User-facing quality matters most; sits at the top of the Sonnet band.

All three route through `lib/llm.ts`. Two additional prompts (general and per-page interviewers) are templates that get personalized then passed as overrides to ElevenLabs — they're not invoked from `lib/llm.ts` directly.

**Central LLM wrapper:**

```ts
// lib/llm.ts (sketch)
export async function callLLM(opts: {
  prompt_name: 'extraction' | 'synthesis' | 'chat-bar' | 'interviewer-general' | 'interviewer-per-page';
  variables: Record<string, string>;
  user_message: string;
  complexity?: number;                   // 1-10; defaults to 5. 1-8 → Sonnet, 9-10 → Opus.
  max_tokens?: number;
  temperature?: number;
}): Promise<string>;
```

Behavior:

- Loads the prompt: checks `prompt_overrides` table; falls back to bundled `/prompts/<name>.md`.
- Substitutes `{variable_name}` placeholders.
- Selects model from `complexity` (default 5): values 1-8 use `SONNET_MODEL` (default `claude-sonnet-4-6`); values 9-10 use `OPUS_MODEL` (default `claude-opus-4-7`).
- Calls Anthropic API.
- Retries on transient errors with exponential backoff (max 3 retries).
- Returns the assistant's response text.

For the two interviewer prompts (used as ElevenLabs overrides), Practice Commons loads the template via the same `loadPrompt(name)` helper used by `callLLM` and performs `{variable}` substitution, then passes the resulting text to ElevenLabs as `system_prompt`. No Anthropic API call is involved.

## 4. Data model (Supabase / Postgres)

```sql
-- Enums
CREATE TYPE object_type AS ENUM ('program', 'paper', 'question', 'specialist');
CREATE TYPE contribution_source AS ENUM ('per_page', 'general', 'voice_interview');
CREATE TYPE voice_session_status AS ENUM (
  'in_progress',       -- conversation underway in the browser
  'transcript_pending',-- conversation ended; transcript not yet retrievable
  'completed',         -- transcript stored as contribution
  'failed',            -- gave up after retries
  'abandoned'          -- conversation never ended cleanly (timeout)
);

-- Objects (unchanged from v1.1)
CREATE TABLE objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  type object_type NOT NULL,
  canonical_name TEXT NOT NULL,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  frontmatter JSONB NOT NULL DEFAULT '{}'::jsonb,
  body TEXT NOT NULL DEFAULT '',
  last_synthesized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (type, slug)
);
CREATE INDEX idx_objects_type ON objects (type);
CREATE INDEX idx_objects_canonical_name_lower ON objects (LOWER(canonical_name));

-- Contributions (unchanged from v1.1 except the enum value)
CREATE TABLE contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source contribution_source NOT NULL,
  raw_input TEXT NOT NULL,
  page_context_type object_type,
  page_context_slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contributions_created_at ON contributions (created_at DESC);

-- Mentions (unchanged)
CREATE TABLE mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  contribution_id UUID NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  text_fragment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mentions_object_id ON mentions (object_id);
CREATE INDEX idx_mentions_contribution_id ON mentions (contribution_id);

-- Prompt overrides (unchanged)
CREATE TABLE prompt_overrides (
  name TEXT PRIMARY KEY,
  override_text TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Queries log (unchanged)
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

-- NEW: Voice sessions — tracks in-progress and pending-transcript ElevenLabs interviews
CREATE TABLE voice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,                              -- ElevenLabs agent ID used for this session
  conversation_id TEXT,                                -- ElevenLabs conversation_id, set when known
  page_context_type object_type,                       -- for per-page voice interviews
  page_context_slug TEXT,
  contributor_expertise TEXT,                          -- optional, from /voice-interview form
  system_prompt TEXT NOT NULL,                         -- the fully personalized prompt sent as override
  first_message TEXT,                                  -- optional first_message override
  status voice_session_status NOT NULL DEFAULT 'in_progress',
  contribution_id UUID REFERENCES contributions(id) ON DELETE SET NULL,
  retry_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_voice_sessions_status ON voice_sessions (status);
CREATE INDEX idx_voice_sessions_conversation_id ON voice_sessions (conversation_id);
CREATE INDEX idx_voice_sessions_created_at ON voice_sessions (created_at DESC);
```

**Notes on the schema:**

- `voice_sessions` is the staging area for in-progress voice interviews; only on transcript success does a `contributions` row get created, preserving the spec's commitment that `contributions.raw_input` is the source-of-truth (no empty or half-written contributions).
- `voice_sessions.system_prompt` snapshots the exact text sent as override — useful for audit and for re-running extraction later via the admin "Re-run extraction" action (which operates on the linked contribution).
- A session moves: `in_progress` (browser conversation active) → `transcript_pending` (conversation ended, transcript not yet retrievable from ElevenLabs) → `completed` (transcript fetched, contribution row created) OR `failed` (retries exhausted) OR `abandoned` (no completion event after timeout window).

Other tables unchanged from v1.1; see prior version for inline notes.

## 5. Pipelines

### 5.1 Extraction pipeline

*(unchanged from v1.1)* — Trigger: `POST /api/contribute` (called from per-page form, general-contribute form, or voice-interview completion handler).

Steps:

1. Insert a row into `contributions` and capture the `id`.
2. Load the alias index: `SELECT id, type, slug, canonical_name, aliases FROM objects;`. Format as a compact list for the LLM.
3. Call extraction LLM (`lib/llm.ts` with `prompt_name: 'extraction'`, `complexity: 5`).
4. Parse the JSON response. Expected shape:

```json
{
  "mentions": [
    {
      "target_slug": "nyu-csc",
      "type": "program",
      "is_new": false,
      "canonical_name_if_new": null,
      "text_fragment": "Reports a 3-month intake delay as of spring 2026..."
    }
  ]
}
```

1. For each mention: insert/upsert object if new, insert mentions row.
2. For each affected object whose type is not `specialist`, run synthesis (§5.2).
3. Return the affected-object list for the thank-you page.

Failure modes unchanged from v1.1.

### 5.2 Synthesis pipeline

*(unchanged from v1.1)* — Confidence-label threshold configurable via `WELL_SUPPORTED_THRESHOLD` env var (default 2).

### 5.3 Chat-bar pipeline

*(unchanged from v1.1)*

### 5.4 Voice interview (REWRITTEN for v1.2)

**Two ElevenLabs agents are pre-provisioned**, one for each interviewer prompt template:

| Agent      | Purpose                                                      | Default `system_prompt` source                               | Overrides enabled                |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------------------ | -------------------------------- |
| `general`  | Top-nav "Start a voice interview" entry                      | `/prompts/interviewer-general.md` (rendered with empty `{contributor_expertise}`) | `system_prompt`, `first_message` |
| `per-page` | Per-page voice contribution affordance (future use; not surfaced in MVP UI but agent exists) | `/prompts/interviewer-per-page.md` (rendered with empty `{object_context}`) | `system_prompt`, `first_message` |

Both agents are configured in the ElevenLabs dashboard with `conversation_config.agent.prompt.prompt` allowing overrides AND `conversation_config.agent.first_message` allowing overrides. Their IDs are wired via env vars `ELEVENLABS_AGENT_GENERAL` and `ELEVENLABS_AGENT_PER_PAGE`.

A one-shot provisioning script (`/scripts/provision-elevenlabs-agents.ts`) creates and configures both agents if their env-var IDs are unset; the script is idempotent (re-running is safe — it updates the existing agents in place). Required because the agents must be configured to **allow overrides**, which is not the ElevenLabs default.

**Per-session flow:**

```
POST /api/voice-interview/start
```

Inputs:

- `kind`: `'general' | 'per-page'`
- `expertise_text`: optional (general only)
- `page_context_type`, `page_context_slug`: required iff `kind === 'per-page'`

Steps:

1. Load the appropriate template via `loadPrompt('interviewer-general' | 'interviewer-per-page')`.
2. Substitute placeholders:
   - `interviewer-general`: `{contributor_expertise}` ← `expertise_text` or `"(no expertise context provided)"`.
   - `interviewer-per-page`: `{object_context}` ← formatted description of the target object (canonical name, type, current frontmatter, current body).
3. Insert a `voice_sessions` row with `status='in_progress'`, capturing `agent_id`, `system_prompt`, optional `first_message`, `page_context_*`, `contributor_expertise`.
4. Call `ElevenLabs.getSignedUrl(agent_id)` to mint a signed URL for the conversation.
5. Return `{ session_id, signed_url, system_prompt, first_message, agent_id }` to the client.

The signed URL is a single-use, short-lived token from ElevenLabs scoped to the agent; minting it server-side keeps the ElevenLabs API key off the client.

**Client widget (`components/VoiceInterviewWidget.tsx`):**

Uses `@elevenlabs/react`'s `useConversation` hook. On mount:

```ts
const conversation = useConversation({
  onConnect: () => { /* capture conversation.getId() */ },
  onDisconnect: () => { /* trigger completion handler */ },
  onError: (err) => { /* surface to UI */ },
  onMessage: (msg) => { /* ignored in MVP; could power live captions later */ },
});

await conversation.startSession({
  signedUrl: props.signedUrl,
  overrides: {
    agent: {
      prompt: { prompt: props.systemPrompt },
      firstMessage: props.firstMessage,
    },
  },
});
```

UI elements:

- Microphone status pill ("Listening" / "Speaking" / "Connecting")
- Elapsed-time counter
- Single "End interview" button (primary action)
- Optional "Cancel" link (abandons the session — POSTs to `/api/voice-interview/start` with `status='abandoned'`)

No pause/resume in MVP — the spec accepts the simpler single-shot model. If the user closes the tab, an `onDisconnect` triggered by `beforeunload` (via `sendBeacon`) attempts to record the conversation_id; an `abandoned` status backstop sweeps any session stuck in `in_progress` after 30 minutes (via the cron at `/api/cron/voice-sessions-sweep`).

**Completion handler:**

`POST /api/voice-interview/complete` (called by the client on `onDisconnect`)

Inputs: `{ session_id, conversation_id }`

Steps:

1. `UPDATE voice_sessions SET conversation_id = $1, status = 'transcript_pending', updated_at = now() WHERE id = $2;`.
2. **Fast retry:** poll ElevenLabs `GET /v1/convai/conversations/{conversation_id}` up to 4 times with delays ~1s, 2s, 4s, 7s (~14s total). Conversation status must be `done` for the transcript to be present.
3. If retrieved within the fast window: a. Format the transcript as a readable string (turn-by-turn, prefixed by speaker). b. `INSERT INTO contributions (source, raw_input, page_context_type, page_context_slug) VALUES ('voice_interview', <transcript>, <type or null>, <slug or null>) RETURNING id;`. c. Run extraction (§5.1) on the new contribution. d. `UPDATE voice_sessions SET status = 'completed', contribution_id = $1, updated_at = now() WHERE id = $2;`. e. Return `{ status: 'completed', contribution_id }` so the client can redirect to `/thank-you?contribution_id=...`.
4. If NOT retrieved within the fast window: schedule a background retry via Next.js `after()`: a. Up to 5 additional attempts with delays ~30s, 60s, 120s, 180s, 240s (~8 min total). b. On success: same flow as 3a-3d. c. On final failure: `UPDATE voice_sessions SET status = 'failed', last_error = $1, retry_count = retry_count + 1 WHERE id = $2;`. d. Return `{ status: 'transcript_pending', session_id }` so the client can show a "we're still processing your interview — check back in a few minutes" message, with a polling link to `/voice-interview/status/[session_id]`.

**Polling endpoint:**

```
GET /voice-interview/status/[session_id]
```

Renders a small page that polls `/api/voice-interview/status/[session_id]` every 30s. On `completed`, redirects to `/thank-you?contribution_id=<id>`. On `failed`, surfaces a "Sorry — we couldn't retrieve your interview transcript. If you'd like, please paste it manually on the contribute page" message linking to `/contribute`.

**Sweep cron:**

`GET /api/cron/voice-sessions-sweep` (Vercel cron every 15 minutes, authed via `CRON_SECRET`):

- Any session `in_progress` older than 30 minutes → `abandoned`.
- Any session `transcript_pending` older than 30 minutes with `retry_count < MAX` → re-attempt transcript fetch.
- Any session `transcript_pending` older than 2 hours → `failed`.

**Failure modes:**

- **ElevenLabs API unreachable at start:** `/api/voice-interview/start` returns a 503; widget shows "Voice service temporarily unavailable — please contribute via paste at /contribute." The fallback to text contribution is always available.
- **conversation_id never captured client-side:** the `voice_sessions` row stays `in_progress` until swept to `abandoned`. No contribution is created. The contributor is informed via the polling page (if they reached it) or simply leaves with no thank-you.
- **Transcript never becomes available:** `failed` status, user prompted to paste manually.

## 6. User flows

### 6.1 Reader flows

*(unchanged from v1.1)*

### 6.2 Contributor flows

**C1 — Mode toggle.** *(unchanged from v1.1)*

**C2 — Per-page contribute.** *(unchanged from v1.1)*

**C3 — General contribute.** *(unchanged from v1.1)*

**C4 — Voice interview entry.** Top-nav "Start a voice interview" link in Contributor mode → `/voice-interview` page with: an optional textarea ("Optional — tell us a few words about your specialty so we can tailor the questions. Leave blank, type a few words, or paste a chunk of text.") + microphone permission prompt + "Start interview" button. On click → `POST /api/voice-interview/start` → page transitions to embedded `VoiceInterviewWidget` showing live status and the End button. No redirect off-site.

**C5 — Voice interview completion.** When the contributor clicks "End interview" (or closes the tab) → client invokes `/api/voice-interview/complete`. If the transcript arrives within ~14s, the user is redirected to `/thank-you?contribution_id=...` (same UI as text contributions). If not, they land on `/voice-interview/status/[session_id]` which polls until completion or failure. On failure, they're directed to the paste fallback at `/contribute`.

**C6 — Thank-you.** *(unchanged from v1.1)*

### 6.3 Admin flows

See Section 8.

## 7. Frontend specification

### 7.1 File layout

```
/app
  layout.tsx
  page.tsx
  q/page.tsx
  programs/page.tsx
  programs/[slug]/page.tsx
  papers/page.tsx
  papers/[slug]/page.tsx
  questions/page.tsx
  questions/[slug]/page.tsx
  specialists/page.tsx
  specialists/[slug]/page.tsx
  contribute/page.tsx
  voice-interview/page.tsx                # optional expertise + embedded ElevenLabs widget
  voice-interview/status/[session_id]/page.tsx   # polling page for pending transcripts
  thank-you/page.tsx
  admin/
    layout.tsx
    page.tsx
    object/[type]/[slug]/page.tsx
    contributions/page.tsx
    queries/page.tsx
    voice-sessions/page.tsx               # admin view of recent voice sessions
    prompts/page.tsx
  api/
    contribute/route.ts                   # POST: extraction → mentions → synthesis
    chat/route.ts                         # POST: chat-bar pipeline
    voice-interview/
      start/route.ts                      # POST: personalize + signed URL + session row
      complete/route.ts                   # POST: fast-retry transcript fetch + extraction
      status/[session_id]/route.ts        # GET: poll session status
    cron/
      voice-sessions-sweep/route.ts       # GET: cron — sweep stale sessions
    admin/
      ...                                 # admin mutations
/components
  TopBar.tsx, ModeToggle.tsx
  Hero.tsx, ChatBar.tsx, ChatResult.tsx, Citation.tsx, RefusalState.tsx
  ConfidenceLabel.tsx
  ObjectPage.tsx, ObjectHeader.tsx, ObjectBody.tsx, ObjectFrontmatter.tsx
  IndexList.tsx
  ContributorForm.tsx, GeneralContributeForm.tsx
  VoiceInterviewForm.tsx                  # the /voice-interview entry form
  VoiceInterviewWidget.tsx                # NEW — embedded ElevenLabs conversation
  VoiceInterviewStatus.tsx                # NEW — polling status page
  ThankYou.tsx
  AdminLayout.tsx, AdminPasswordGate.tsx, AdminObjectEditor.tsx, AdminPromptEditor.tsx,
  AdminVoiceSessionsList.tsx              # NEW
/lib
  llm.ts                                  # central Anthropic SDK wrapper
  supabase.ts                             # Supabase client (server-side)
  content.ts                              # high-level content access
  extraction.ts                           # extraction pipeline
  synthesis.ts                            # synthesis pipeline
  chatbar.ts                              # chat-bar pipeline
  prompts.ts                              # prompt loader (DB override → bundled default)
  elevenlabs.ts                           # NEW — ElevenLabs REST client (signed URL, transcript fetch, agent provisioning)
  parsing.ts                              # parse [ref: ...] and confidence markers
/prompts
  extraction.md
  synthesis.md
  chat-bar.md
  interviewer-general.md                  # contains {contributor_expertise} placeholder
  interviewer-per-page.md                 # contains {object_context} placeholder
/styles
  tokens.css
  globals.css
/tailwind.config.ts
/seeds
  README.md
  interviews/
    01.md, 02.md, 03.md, 04.md, 05.md
  initial-objects/
    programs/, papers/, questions/, specialists/
  queries.md
/scripts
  seed.ts                                 # imports /seeds/ into Supabase
  provision-elevenlabs-agents.ts          # NEW — idempotently creates/configures the two agents
/docs
  elevenlabs-integration.md               # NEW — replaces groupstack-contract.md
  v2-deferred.md
README.md
```

### 7.2 Design tokens

*(unchanged from v1.1)*

### 7.3 Component conventions

*(unchanged from v1.1, with one addition)*

`VoiceInterviewWidget.tsx` is a client component (`'use client'`) wrapping `@elevenlabs/react`'s `useConversation`. It receives `{ session_id, signed_url, system_prompt, first_message, agent_id }` from the server-rendered page and is responsible for:

- Starting the session with overrides
- Surfacing connection/listening/speaking states visually
- Capturing `conversation_id` on `onConnect` (and from `sessionStorage` as a fallback on unload)
- Calling `/api/voice-interview/complete` on disconnect (via fetch in normal case, via `navigator.sendBeacon` on `beforeunload`)
- Showing the elapsed timer and an "End interview" button

### 7.4 Responsive

*(unchanged from v1.1)*

## 8. Admin interface

### 8.1 Auth

*(unchanged from v1.1)*

### 8.2 Admin pages

`/admin` (index), `/admin/object/[type]/[slug]`, `/admin/contributions`, `/admin/queries`, `/admin/prompts` — *(all unchanged from v1.1)*

**NEW: `/admin/voice-sessions`.** Chronological list of voice sessions. Shows `created_at`, `agent_id` (general / per-page), `status`, `conversation_id` (if known), linked `contribution_id` (if completed), `last_error` (if failed), and `retry_count`. Filters: `all` / `in_progress` / `transcript_pending` / `completed` / `failed` / `abandoned`. Click into any row to see the full snapshotted `system_prompt`. Admin actions per row:

- **Retry transcript fetch** — visible on `transcript_pending` and `failed`. Re-attempts the ElevenLabs transcript fetch with retry counter incremented. On success, creates the contribution and runs extraction.
- **Mark abandoned** — manual cleanup for stuck `in_progress` sessions.
- **Delete session** — hard delete (only useful for noise cleanup).

A linked contribution (if present) is editable via the standard contributions admin flow — including "Re-run extraction" against the stored transcript.

## 9. ElevenLabs integration (filled in for v1.2)

This section replaces the prior Groupstack contract.

### 9.1 Account & agents

A single ElevenLabs workspace hosts two conversational agents:

- **`general`** — for the `/voice-interview` top-nav entry.
- **`per-page`** — for future per-object voice contributions (provisioned in MVP but UI hookup is V2).

Both agents must have, in their `conversation_config`:

```json
{
  "agent": {
    "prompt": {
      "prompt": "<default-fallback>"
    },
    "first_message": "Hi — what brings you here today?",
    "language": "en"
  },
  "platform_settings": {
    "overrides": {
      "conversation_config_override": {
        "agent": {
          "prompt": { "prompt": true },
          "first_message": true
        }
      }
    }
  }
}
```

The `overrides` block is the critical part: without explicitly allowing `prompt.prompt` and `first_message`, ElevenLabs will reject the per-session overrides Practice Commons sends.

### 9.2 Server-side client (`lib/elevenlabs.ts`)

Exports:

```ts
export async function getSignedUrl(agentId: string): Promise<string>;
export async function getConversation(conversationId: string): Promise<{
  status: 'in-progress' | 'processing' | 'done' | 'failed';
  transcript?: Array<{ role: 'user' | 'agent'; message: string | null; time_in_call_secs?: number }>;
}>;
export async function provisionAgent(opts: {
  name: string;
  defaultPrompt: string;
  defaultFirstMessage?: string;
  existingId?: string;  // if set, updates in place
}): Promise<{ id: string }>;
```

All calls are server-side only, authed with `ELEVENLABS_API_KEY` (kept off the client). Signed URL minting uses `GET /v1/convai/conversation/get-signed-url?agent_id=<id>`. Conversation fetch uses `GET /v1/convai/conversations/{conversation_id}`. Agent provisioning uses `POST /v1/convai/agents/create` and `PATCH /v1/convai/agents/{id}`.

### 9.3 Override payload sent from client

The `VoiceInterviewWidget` calls `useConversation().startSession({ ... })` with:

```ts
{
  signedUrl: <from server>,
  overrides: {
    agent: {
      prompt: { prompt: <personalized system_prompt> },
      firstMessage: <optional first_message>,
    },
  },
}
```

The signed URL ties the session to a specific agent ID; the overrides take effect because the agent's `platform_settings.overrides` allows them.

### 9.4 Transcript shape

ElevenLabs returns a `transcript` array of `{ role, message, time_in_call_secs }` turns. Practice Commons flattens these into a human-readable string before storing as `contributions.raw_input`:

```
[Interviewer] Hi — what brings you here today?
[Contributor] I'm an OT who works mostly with...
[Interviewer] Tell me about the three questions you get asked most.
...
```

Null-message turns (e.g., from pause/resume) are dropped. The flattened string is what the extraction LLM sees.

### 9.5 Provisioning script

`/scripts/provision-elevenlabs-agents.ts` reads `ELEVENLABS_AGENT_GENERAL` and `ELEVENLABS_AGENT_PER_PAGE` from env. If either is empty, calls `provisionAgent` with the appropriate template's empty-state-rendered text as the default prompt, then prints the new IDs for the operator to set as env vars. If both are set, calls `provisionAgent` with `existingId` to PATCH the agents in place (idempotent — useful when default prompts change).

### 9.6 Cost & quota notes

- ElevenLabs Conversational AI is billed per character of agent speech. Typical 5-minute interview ≈ 800-1500 characters of agent speech ≈ a few cents per session on the standard plan.
- No rate limiting in MVP; if abuse becomes an issue, gate `/api/voice-interview/start` by IP rate (10/hour) — deferred to V2.

## 10. Deliverables

The coding agent produces:

1. **Application code** per the file layout in §7.1.
2. **Five prompts in `/prompts/`** *(unchanged from v1.1)*.
3. **Token files** *(unchanged)*.
4. **Seed corpus scaffolding** *(unchanged; see §11)*.
5. **Database setup:**
   - SQL migration file in `/supabase/migrations/` matching §4 (now including `voice_sessions`).
   - Seeding script (`/scripts/seed.ts`) — idempotent.
6. **ElevenLabs agent provisioning script** — `/scripts/provision-elevenlabs-agents.ts`, idempotent.
7. **`README.md` operating playbook:**
   - Environment variables: `ANTHROPIC_API_KEY`, `ADMIN_PASSWORD`, `SONNET_MODEL`, `OPUS_MODEL`, `WELL_SUPPORTED_THRESHOLD`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_GENERAL`, `ELEVENLABS_AGENT_PER_PAGE`, `FEEDBACK_EMAIL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
   - Admin playbook: merging duplicates, regenerating synthesis, deleting mentions/objects, editing prompts, viewing queries, **inspecting voice sessions and retrying stuck transcript fetches**, adjusting the well-supported threshold.
   - Local dev setup, including how to run the provisioning script for the first time and where to grab the resulting agent IDs.
   - Deploy walkthrough: Vercel + Supabase wiring + ElevenLabs agent configuration (link to `/docs/elevenlabs-integration.md`).
8. **`/docs/elevenlabs-integration.md`** — standalone integration doc covering §9 in depth (agent setup screenshots, override gotchas, transcript fetching behavior, cost notes).
9. **`/docs/v2-deferred.md`** — the V2 deferral list.

## 11. Seed corpus

*(unchanged from v1.1)*

## 12. Open items and V2 deferred

### Known open items at MVP launch

- **ElevenLabs agent provisioning is manual on first deploy.** The provisioning script creates agents but the operator must copy the resulting IDs into env vars. Acceptable for MVP; automate in V2 if multi-environment deploys become common.
- **No voice rate limiting.** A bored visitor could burn ElevenLabs credit by starting many interviews. Acceptable risk at MVP demo scale; add IP-based rate limiting if it becomes a real problem.
- **No multi-session voice.** If a contributor's connection drops mid-interview, they restart from scratch — the prior partial conversation is captured as `abandoned` and surfaced in `/admin/voice-sessions`. Multi-session merging is deferred.
- **No live captions.** ElevenLabs sends user/agent transcript turns via `onMessage` during the call, but rendering them live is deferred. The full transcript becomes available post-call.
- **Entity resolution edge cases.** *(unchanged)*
- **Prompt-engineering quality.** *(unchanged)*
- **Person-first / identity-first toggle.** *(unchanged — remove from MVP UI)*

### V2 / deferred (full list)

- Contributor records (top V2 priority): soft self-identification, profile records, activity tracking, optional linkage to Specialist records, expertise URL paste-in with fetch + extraction.
- Per-contributor analytics.
- Member-checking flow.
- Moderation queue.
- Full Specialists pages with peer characterizations.
- Real authentication replacing the `/admin` password gate.
- Multi-URL public-trace enrichment.
- Browser voice recording for text contributions (Whisper).
- Per-page voice interviews surfaced in UI (the `per-page` agent is provisioned but the page-level voice affordance is V2).
- Live captions during voice interviews.
- Multi-session voice support (reconnect → merged transcript).
- Pause/resume on voice interviews.
- IP-based rate limiting for voice and chat-bar.
- Person-first / identity-first language toggle.
- Visible version history per object.
- More sophisticated retrieval (vector embeddings, BM25 pre-filter) when corpus exceeds ~75K tokens.
- Topic-specific update cadence.

## 13. Acceptance criteria for MVP build

The coding agent's build is complete when:

1. A user can visit the deployed site, type a query, and receive a grounded answer with at least one citation linking to a seeded object page.
2. A user can toggle to Contributor mode, submit a contribution via the per-page form on any non-Specialist object, and see a thank-you page listing the affected objects with extracted fragments.
3. A user can paste a transcript into `/contribute` and see one or more objects updated.
4. **A user can visit `/voice-interview`, optionally enter expertise text, click "Start interview," conduct a voice conversation in-browser via the embedded ElevenLabs widget, click "End interview," and (within ~14s in the typical case) land on the thank-you page with extracted fragments. If transcript retrieval takes longer, they land on a polling page that resolves to the thank-you page when the transcript becomes available (or to a manual-paste fallback message on transcript failure).**
5. Admin can log into `/admin` with the configured password, browse all objects, edit aliases, regenerate synthesis, delete a mention, view a contribution's full raw text and re-run extraction on it, **inspect voice sessions and retry stuck transcript fetches**, and edit/revert a prompt override.
6. Admin can merge a duplicate object into its canonical match via the admin Merge action *(unchanged from v1.1)*.
7. The chat-bar refuses cleanly when asked an out-of-corpus question.
8. The seed script (`pnpm seed`) runs end-to-end on a fresh Supabase project.
9. **The ElevenLabs agent provisioning script (`pnpm provision-elevenlabs`) runs end-to-end against the configured ElevenLabs workspace, either creating or updating both agents with overrides enabled. The integration doc at `/docs/elevenlabs-integration.md` is complete and readable as a standalone document.**

## Appendix A: Key environment variables

```bash
# LLM
ANTHROPIC_API_KEY=...
SONNET_MODEL=claude-sonnet-4-6
OPUS_MODEL=claude-opus-4-7

# Synthesis
WELL_SUPPORTED_THRESHOLD=2

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Admin
ADMIN_PASSWORD=andrea

# ElevenLabs
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_GENERAL=agent_xxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_AGENT_PER_PAGE=agent_xxxxxxxxxxxxxxxxxxxxxxxx

# Cron
CRON_SECRET=...                            # used by /api/cron/voice-sessions-sweep

# Feedback
FEEDBACK_EMAIL=info@practicecommons.example.com
```

## Appendix B: Glossary

- **Object.** A canonical record about a Program, Paper, Question, or Specialist. One row in `objects`.
- **Mention.** An extracted text fragment about an object, derived from a contribution. One row in `mentions`.
- **Contribution.** A submission from a contributor — per-page, general paste, or voice-interview transcript. One row in `contributions`.
- **Voice session.** *(NEW)* An in-progress or pending-transcript ElevenLabs interview. One row in `voice_sessions`. Converts to a `contributions` row on successful transcript retrieval.
- **Synthesis.** The regenerated body text of an object, produced by the synthesis LLM call from all mentions of that object.
- **Confidence label.** One of `well-supported` / `single-source` / `contested`. `well-supported` requires ≥ `WELL_SUPPORTED_THRESHOLD` agreeing mentions (default 2).
- **Citation.** An inline `[ref: <type>/<slug>]` marker in chat-bar output.
- **Refusal.** The chat-bar's response when the corpus doesn't cover the query.
- **Alias.** A non-canonical name resolving to the same object as the canonical name.
- **Override (ElevenLabs).** *(NEW)* A per-session value (`system_prompt`, `first_message`) passed by the client to ElevenLabs at conversation start. Requires the agent's `platform_settings.overrides` to explicitly allow each field.

