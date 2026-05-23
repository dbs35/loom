# Practice Commons

A knowledge commons for the autism community — Programs, Papers, Questions,
and Specialists, written down by the practitioners who do the work and
synthesized into one canonical page per object.

This README is the operating playbook for running and administering the
MVP. The design spec lives in `docs/Practice Commons MVP — Design Spec v1.2.md`;
the V2 deferral list lives in `docs/v2-deferred.md`; ElevenLabs setup
details live in `docs/elevenlabs-integration.md`.

## Stack

- Next.js 15 (App Router) on Vercel
- Supabase (Postgres) for persistence
- Anthropic Claude (Sonnet + Opus) via `@anthropic-ai/sdk` for extraction,
  synthesis, and the chat-bar
- ElevenLabs Conversational AI (`@elevenlabs/react`) for in-browser voice
  interviews

## Repository layout

```
/app          Next.js App Router (route groups for public vs admin)
  (public)/   Reader + contributor UI
  admin/      Password-gated admin surface
  api/        Route handlers (public + admin mutations + cron)
/components   React components (server-default; `'use client'` only where needed)
/lib          Server-side primitives (LLM, Supabase, pipelines, auth)
/prompts      The five bundled prompts (extraction, synthesis, chat-bar, two interviewers)
/seeds        23-object seed corpus + 5 synthetic interviews + demo queries
/scripts      Seed loader + ElevenLabs agent provisioning
/styles       Design tokens + globals
/supabase     SQL migrations
/docs         Spec, integration guides, V2 deferrals
```

## Environment variables

All are required for a full deploy. Local development can omit ElevenLabs
keys if voice is not being exercised.

```bash
# LLM
ANTHROPIC_API_KEY=sk-ant-...
SONNET_MODEL=claude-sonnet-4-6     # used for complexity 1–8
OPUS_MODEL=claude-opus-4-7         # used for complexity 9–10

# Synthesis threshold — number of distinct mentions before a claim is
# labeled [well-supported]; smaller threshold = more confident labels
# earlier in a corpus's life.
WELL_SUPPORTED_THRESHOLD=2

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # server-only, never exposed to client

# Admin
ADMIN_PASSWORD=andrea              # MVP-only password gate; see "Admin" below

# ElevenLabs voice
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_AGENT_GENERAL=agent_xxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_AGENT_PER_PAGE=agent_xxxxxxxxxxxxxxxxxxxxxxxx

# Cron — Vercel sends `Authorization: Bearer <CRON_SECRET>` on cron requests
CRON_SECRET=...

# Feedback (used as a mailto: on the thank-you page)
FEEDBACK_EMAIL=info@practicecommons.example.com
```

Copy `.env.example` to `.env` and fill the values.

## Local development

```bash
pnpm install

# 1. Apply the Supabase schema (against a fresh project)
#    The migration is at supabase/migrations/0001_init.sql; either run it
#    via the Supabase CLI (`supabase db push`) or paste it into the
#    Supabase SQL editor.

# 2. Provision the two ElevenLabs agents (first time only)
#    See "First-time ElevenLabs provisioning" below.

# 3. Load the seed corpus
pnpm seed

# 4. Run the dev server
pnpm dev
```

`pnpm seed` is idempotent: it upserts the 23 object scaffolds, then runs
each of the five seed interviews through the live extraction + synthesis
pipelines. Re-running creates no duplicates.

### Typecheck & build

```bash
pnpm typecheck
pnpm build
```

### First-time ElevenLabs provisioning

The first time you deploy (or the first time `ELEVENLABS_AGENT_GENERAL` /
`ELEVENLABS_AGENT_PER_PAGE` are empty), run:

```bash
pnpm provision-elevenlabs
```

The script reads `ELEVENLABS_AGENT_GENERAL` and `ELEVENLABS_AGENT_PER_PAGE`
from env. If either is empty it calls the ElevenLabs `create` endpoint and
prints the new agent IDs — copy them into your `.env` (or the Vercel project
env) as the respective variables, then re-run any deploy that needs them.
If both are already set, the script `PATCH`es each agent in place
(idempotent — useful when default prompts change).

See `docs/elevenlabs-integration.md` for the override gotchas (the
`platform_settings.overrides` block must allow `prompt.prompt` and
`first_message`).

## Deploy walkthrough

1. **Supabase.** Create a project, run `supabase/migrations/0001_init.sql`,
   then `supabase/migrations/0002_enable_rls.sql`. Grab the URL, anon key,
   and service-role key.
2. **ElevenLabs.** Create a workspace, generate an API key. Run
   `pnpm provision-elevenlabs` once locally with `ELEVENLABS_API_KEY` set
   and both `ELEVENLABS_AGENT_*` env vars empty; capture the printed IDs.
3. **Vercel.** Import the repo. Set all env vars listed above. The cron
   in `vercel.json` (`/api/cron/voice-sessions-sweep` every 15 minutes)
   uses `CRON_SECRET`; Vercel sends it automatically as
   `Authorization: Bearer <CRON_SECRET>`.
4. **Seed.** With env vars set locally, run `pnpm seed` against the
   production Supabase URL — or run it via a one-shot Vercel job — to
   populate the demo corpus.
5. **Smoke-test.** Visit `/` → ask a query → verify the chat-bar returns
   a cited answer. Visit `/voice-interview` → end-to-end a short call
   and confirm it lands on `/thank-you` or the polling page.

## Admin

`/admin` is gated by `ADMIN_PASSWORD`. This is a hardcoded password set
via environment variable — it is **not** real authentication. Anyone with
the password has full edit access to every object, contribution, query,
voice session, and prompt. Documented as MVP-only; replace with real auth
in V2.

On first visit to any `/admin/*` route the layout renders a password form.
On submit, `/api/admin/login` validates the password (constant-time
compare against `ADMIN_PASSWORD`) and sets an httpOnly signed cookie. The
cookie's signature is derived from `ADMIN_PASSWORD` itself — rotating the
password invalidates all existing sessions.

### Admin playbook

The five admin pages, in the order Andrea most often needs them.

#### `/admin` — objects

Lists every object grouped by type. Click a row to open the editor.

#### `/admin/object/[type]/[slug]` — object editor

- **Frontmatter.** Edit `canonical_name`, `aliases` (one per line), and
  every frontmatter field. Field values typed as `true`/`false`,
  integers, or JSON arrays/objects are coerced on save; everything else
  stays as a string.
- **Regenerate synthesis.** Runs the synthesis pipeline against this
  object's mentions on demand. Use after editing the prompt, after
  deleting mentions, or when a body looks stale. Takes ~5–15 seconds.
- **Mentions list.** Every extracted fragment, chronological. Each row
  has a "Delete mention" affordance — deleting cascades to
  re-synthesizing the object so the body reflects the remaining
  mentions.
- **Merge into another object.** The primary entity-resolution tool.
  Pick a target object of the same type; the action atomically
  repoints all mentions to the target, folds the source's
  `canonical_name` + `aliases` into the target's alias list
  (deduplicated, case-insensitive), deletes the source, and
  re-synthesizes the target. Expect to use this routinely while the
  corpus is small.
- **Delete object.** Hard-delete; mentions cascade. Use only when no
  canonical equivalent exists to merge into.

#### `/admin/contributions` — contributions

- The list view shows source, preview, page context, and affected-object
  count for every contribution.
- The detail page shows the full `raw_input` (the entire transcript or
  pasted text — never truncated, never overwritten), the list of
  affected objects with their extracted fragments, and two actions:
  - **Re-run extraction.** Deletes the existing mentions for this
    contribution, re-runs extraction against the stored `raw_input`
    (picking up any prompt overrides since the original run), and
    re-synthesizes the previously- and newly-affected objects. The
    expected workflow after iterating on `extraction.md`: replay
    historical contributions to test the new prompt and upgrade the
    existing corpus.
  - **Delete contribution.** Removes the contribution row and cascades
    to its mentions; previously-affected objects re-synthesize from
    their remaining mentions.

#### `/admin/queries` — queries log

Chronological list of every chat-bar query. Filter by `all` /
`answered` / `refusals only`. Useful for spotting demand patterns —
clusters of refusals usually indicate gaps in the corpus.

#### `/admin/voice-sessions` — voice sessions

Chronological list of every voice interview session, filterable by
status (`in_progress` / `transcript_pending` / `completed` / `failed` /
`abandoned`). The detail page shows the full snapshotted system prompt
sent to ElevenLabs, the linked contribution (if any), and three
actions:

- **Retry transcript fetch** — visible on `transcript_pending` and
  `failed`. Re-attempts `getConversation` against the stored
  `conversation_id`. On success, finalizes the session (insert
  contribution, run extraction). Increments `retry_count` either way.
- **Mark abandoned** — manual cleanup for stuck `in_progress` or
  `transcript_pending` sessions.
- **Delete session row** — hard delete, leaves any linked contribution
  alone.

A 15-minute cron (`/api/cron/voice-sessions-sweep`) automatically
times out very stale sessions; the admin actions exist for cases
where the cron has not yet run or where a session has a specific
known failure to investigate.

#### `/admin/prompts` — prompt library

One section per prompt (`extraction`, `synthesis`, `chat-bar`,
`interviewer-general`, `interviewer-per-page`). Each section shows the
effective text — the override if one exists, otherwise the bundled
default — with a label indicating which is in effect. **Save override**
upserts a row in `prompt_overrides`. **Revert to default** deletes the
override row so the bundled `/prompts/*.md` text takes effect again.

The `loadPrompt` helper in `lib/prompts.ts` checks `prompt_overrides`
on every call, so edits take effect immediately on the next pipeline
run — no redeploy required.

### Adjusting the well-supported threshold

`WELL_SUPPORTED_THRESHOLD` (default `2`) is the number of distinct
mentions before the synthesis prompt is allowed to label a claim
`[well-supported]`. Set it lower (`1`) early in a corpus's life if
single-source claims should still be labeled confidently; set it higher
(`3` or `4`) once the corpus matures and you want a more conservative
bar. Change the env var, redeploy (or restart `pnpm dev`), then trigger
a synthesis regeneration on any object whose body should reflect the
new threshold.

## Architecture notes

- `lib/extraction.ts` is called from three places: the `/api/contribute`
  route, the voice-completion handler (`lib/voice.ts`), and the seed
  script. The exported `runExtraction` accepts an optional
  pre-inserted contribution id so all three callers share one path.
- `lib/synthesis.ts` is called both as the tail of every extraction
  run and on demand from the admin "Regenerate synthesis" button.
- `contributions.raw_input` is source-of-truth — never truncated, never
  overwritten. The re-run extraction admin action and the voice
  transcript both rely on this.
- Specialists never synthesize. Enforced in `extraction.ts` (skips
  mentions of type `specialist`) and in `synthesis.ts` (early return
  on `type === 'specialist'`). Specialist pages render frontmatter only.
- Row-level security (`supabase/migrations/0002_enable_rls.sql`) is
  enabled on all tables and denies-by-default for the `anon` and
  `authenticated` roles. All reads and writes go through the
  service-role key on the server.

## License

Internal MVP. No license declared.
