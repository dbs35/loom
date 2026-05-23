# ElevenLabs integration

This document describes how Practice Commons integrates with ElevenLabs Conversational AI for voice interviews. It is the operator-facing companion to spec §9.

## Overview

Practice Commons uses **two pre-provisioned ElevenLabs agents** that share the same default configuration:

| Agent       | Surfaced in   | Default prompt source                  |
| ----------- | ------------- | -------------------------------------- |
| `general`   | `/voice-interview` top-nav entry        | `/prompts/interviewer-general.md`      |
| `per-page`  | Per-object voice contribution (V2 only) | `/prompts/interviewer-per-page.md`     |

Both agents allow per-session overrides of `agent.prompt.prompt` and `agent.first_message`. The personalization happens in `/api/voice-interview/start`, which:

1. Loads the appropriate prompt template via `loadPrompt` (DB override → bundled default).
2. Substitutes `{contributor_expertise}` (general) or `{object_context}` (per-page).
3. Inserts a `voice_sessions` row with `status='in_progress'`, capturing the snapshotted prompt and metadata.
4. Mints a single-use signed URL from ElevenLabs (`GET /v1/convai/conversation/get-signed-url?agent_id=…`).
5. Returns the signed URL plus the override payload to the client widget.

The client widget (`@elevenlabs/react`'s `useConversation`) opens the WebSocket using the signed URL and passes the overrides via `startSession({ overrides })`. The signed URL ties the session to a specific agent ID; the overrides take effect because the agent's `platform_settings.overrides` block allows them.

## First-time setup

You need:

- An ElevenLabs account on a plan that includes Conversational AI.
- An API key: `ELEVENLABS_API_KEY` (Settings → API keys; treat as a secret, never expose to the client).
- The two agents — created either via the dashboard, or in one shot via the provisioning script:

```bash
pnpm provision-elevenlabs
```

On first run (with `ELEVENLABS_AGENT_GENERAL` and `ELEVENLABS_AGENT_PER_PAGE` unset), the script creates both agents with the correct `conversation_config` and `platform_settings.overrides` block, then prints the new agent IDs. Copy those into your env:

```env
ELEVENLABS_AGENT_GENERAL=agent_…
ELEVENLABS_AGENT_PER_PAGE=agent_…
```

On subsequent runs (both vars set), the script PATCHes the existing agents in place — safe to re-run whenever you edit the bundled interviewer prompts and want the agent defaults to match.

## Agent configuration shape

The provisioning script writes this `conversation_config` for each agent:

```json
{
  "agent": {
    "prompt": { "prompt": "<rendered template with empty placeholders>" },
    "first_message": "<canonical opener>",
    "language": "en"
  }
}
```

And this `platform_settings.overrides` block (critical — without it, ElevenLabs rejects the per-session override payload):

```json
{
  "overrides": {
    "conversation_config_override": {
      "agent": {
        "prompt": { "prompt": true },
        "first_message": true
      }
    }
  }
}
```

If you edit the agents via the dashboard, do not turn the override flags off.

## Per-session flow

```
POST /api/voice-interview/start
```

Body (start):
```json
{
  "kind": "general",
  "expertise_text": "school psychologist in NYC, primarily K-8 evaluation"
}
```

Or:
```json
{
  "kind": "per-page",
  "page_context_type": "program",
  "page_context_slug": "westside-behavioral"
}
```

Response (start):
```json
{
  "session_id": "<uuid>",
  "signed_url": "wss://api.elevenlabs.io/v1/convai/conversation?…",
  "system_prompt": "<rendered prompt>",
  "first_message": "Thanks for doing this. …",
  "agent_id": "agent_…"
}
```

Body (abandon — when the user clicks Cancel before connecting):
```json
{
  "session_id": "<uuid>",
  "status": "abandoned"
}
```

Response (abandon): `{ "ok": true }`. The session row is transitioned from `in_progress` → `abandoned` only if it was still `in_progress` (conditional update).

## Completion flow

```
POST /api/voice-interview/complete
Body: { "session_id": "<uuid>", "conversation_id": "<elevenlabs id>" }
```

Steps:

1. **Claim:** conditional update — set `status='transcript_pending'` and capture `conversation_id` only if the row is still `in_progress`. If zero rows affected (e.g., the user already cancelled, or `sendBeacon` already completed it), the handler returns `{status: "already_processed"}` and exits.
2. **Fast-retry window (~14 s):** poll `GET /v1/convai/conversations/{conversation_id}` with delays of 1 s, 2 s, 4 s, 7 s. The conversation must reach `status='done'` for the `transcript` array to be populated.
3. **On fast-retry success:** flatten the transcript turns into a single string (`[Interviewer] …\n[Contributor] …`), insert a `contributions` row with `source='voice_interview'`, run extraction with that contribution ID, and mark the session `completed` with the new `contribution_id`. Respond `{status: "completed", contribution_id}` so the client can redirect to `/thank-you?contribution_id=…`.
4. **On fast-retry miss:** schedule a background retry via Next 15's `after()`. Five more attempts with delays of 30 s, 60 s, 120 s, 180 s, 240 s (~8 min total). On success, same finalize path. On final failure, mark the session `failed` with `retry_count=9` and `last_error="Transcript never became available"`. Respond `{status: "transcript_pending", session_id}` immediately so the client can redirect to the polling page.

## Polling page

`/voice-interview/status/[session_id]` is a small client page that polls `/api/voice-interview/status/[session_id]` every 30 seconds. On `completed`, it auto-redirects to `/thank-you`. On `failed` or `abandoned`, it shows a "we couldn't retrieve your transcript" message with a CTA to `/contribute` (paste fallback).

## Sweep cron

`GET /api/cron/voice-sessions-sweep` runs every 15 minutes via Vercel cron (`vercel.json`). The route is authed by an `Authorization: Bearer ${CRON_SECRET}` header that Vercel sets automatically when the `CRON_SECRET` env var is configured. Three operations:

1. Any `in_progress` session older than 30 minutes → `abandoned`.
2. Any `transcript_pending` session older than 30 minutes with `retry_count < 9` → re-attempt the ElevenLabs fetch synchronously; if `done`, finalize; otherwise bump `retry_count`.
3. Any `transcript_pending` session older than 2 hours → `failed` with `last_error="Sweep: transcript_pending too long"`.

## Transcript shape

ElevenLabs returns:

```json
{
  "status": "done",
  "transcript": [
    { "role": "agent", "message": "Hi — what brings you here today?", "time_in_call_secs": 0.3 },
    { "role": "user", "message": "I'm an OT who works mostly with…", "time_in_call_secs": 4.2 }
  ]
}
```

Practice Commons flattens this into a human-readable string before storing as `contributions.raw_input`:

```
[Interviewer] Hi — what brings you here today?
[Contributor] I'm an OT who works mostly with…
```

Null-message turns (e.g., from pause/resume events) are dropped. The flattened string is what the extraction LLM sees.

## Override gotchas

- The `platform_settings.overrides.conversation_config_override.agent.first_message` flag must be `true`. The dashboard hides this behind an "Advanced" toggle. The provisioning script handles it automatically.
- The signed URL is single-use and short-lived (minutes). Don't cache it.
- The signed URL ties the session to a specific `agent_id`. You cannot override the agent itself per session — only `prompt.prompt` and `first_message`.
- The system-prompt override is applied on `startSession`, not on each turn. If you need to change it mid-conversation, end the session and start a new one.

## Cost & quota

- Conversational AI is billed per character of agent speech. A typical 5-minute interview is ~800–1500 characters of agent speech — a few cents per session on the standard plan.
- No per-IP rate limiting is wired up in MVP. If abuse becomes an issue, gate `/api/voice-interview/start` by IP (10/hour is a reasonable starting point).

## Failure modes

| Failure                                        | Behavior                                                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `getSignedUrl` 5xx at start                    | `/api/voice-interview/start` returns 503; widget surfaces "Voice service temporarily unavailable."          |
| `agent_id` env var unset                       | `/api/voice-interview/start` returns 503.                                                                   |
| `conversation_id` never captured client-side   | Session row stays `in_progress` until the 30-min sweep marks it `abandoned`. No contribution created.       |
| Transcript never reaches `done`                | After fast + slow retries, session marked `failed`; user lands on the polling page → paste-fallback CTA.    |
| User closes the tab mid-call                   | `beforeunload` fires `navigator.sendBeacon` to `/api/voice-interview/complete` with the captured `conversation_id`. |
| User clicks Cancel before connecting           | Widget calls `/api/voice-interview/start` with `{status: "abandoned"}`; session row transitions cleanly.    |
| User clicks End normally                       | `onDisconnect` fires `completeSession`; the normal completion flow runs.                                    |

## Admin visibility

`/admin/voice-sessions` (Phase 7) shows every session chronologically with status, conversation ID, contribution ID (if linked), last error, and retry count. Per-row actions: re-attempt transcript fetch (visible on `transcript_pending` and `failed`), mark abandoned, delete session.
