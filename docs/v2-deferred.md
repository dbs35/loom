# V2 / deferred

Items intentionally excluded from the MVP. Captured here so the MVP stays
narrow and so each item is recoverable when the time comes to scope a V2.

## Known open items at MVP launch

- **ElevenLabs agent provisioning is manual on first deploy.** The
  provisioning script (`pnpm provision-elevenlabs`) creates the two agents,
  but the operator must copy the resulting agent IDs into the deployment's
  environment variables. Acceptable for a single deploy; automate in V2 if
  multi-environment deploys become common.
- **No voice rate limiting.** A bored visitor could burn ElevenLabs credit
  by repeatedly starting interviews. Acceptable risk at MVP demo scale.
  Add IP-based rate limiting on `POST /api/voice-interview/start` if it
  becomes a real problem.
- **No multi-session voice.** If a contributor's connection drops mid-
  interview, they restart from scratch. The partial conversation is
  captured with status `abandoned` and surfaced in
  `/admin/voice-sessions`. Multi-session merging is deferred.
- **No live captions during voice interviews.** ElevenLabs streams user
  and agent turns via `onMessage` during the call, but rendering them
  live is deferred. The full transcript is available post-call.
- **Entity resolution edge cases.** The extraction LLM occasionally
  produces duplicate objects ("NYU Child Study Center" vs. "NYU CSC").
  Cleanup is admin-driven via the Merge action — expect to run it
  routinely while the corpus is small. A V2 batch dedup pass would
  remove some of that toil.
- **Prompt-engineering quality.** All five prompts are first-pass. They
  are intentionally editable via `/admin/prompts` so they can be tuned
  against live contributions without redeploying.
- **Person-first / identity-first language toggle.** Visible in the
  painted-door mockup but explicitly removed from MVP UI per design spec
  §12.

## V2 / deferred (full list)

- **Contributor records** *(top V2 priority).* Soft self-identification,
  profile records, activity tracking, optional linkage to Specialist
  records, expertise URL paste-in with fetch + extraction.
- **Per-contributor analytics.**
- **Member-checking flow.** Letting contributors review and amend the
  synthesized text drawn from their input before it goes live.
- **Moderation queue.** A pre-publish review step for contributions
  flagged by heuristics or by other contributors.
- **Full Specialists pages with peer characterizations.** MVP Specialist
  pages are stub-only (factual frontmatter, no body, no peer synthesis).
- **Real authentication** replacing the `/admin` hardcoded-password gate.
- **Multi-URL public-trace enrichment.** Letting contributors paste URLs
  to public bios, papers, or talks so the system can fetch and extract
  additional context.
- **Browser voice recording for text contributions** (e.g., Whisper-based
  transcription), distinct from the conversational ElevenLabs voice flow.
- **Per-page voice interviews surfaced in UI.** The `per-page` agent is
  provisioned in MVP; surfacing the page-level voice affordance is V2.
- **Live captions during voice interviews.**
- **Multi-session voice support** (reconnect → merged transcript).
- **Pause/resume on voice interviews.**
- **IP-based rate limiting** for voice and chat-bar endpoints.
- **Person-first / identity-first language toggle.**
- **Visible version history per object.** The contribution log already
  captures every input, but the per-object page does not yet expose
  prior synthesized states.
- **More sophisticated retrieval** (vector embeddings, BM25 pre-filter)
  when the corpus exceeds ~75K tokens and the whole-corpus prompt of
  the chat-bar pipeline becomes uneconomical.
- **Topic-specific update cadence.** Today every contribution triggers
  full synthesis of the affected objects. At scale this may want to
  batch by topic.
