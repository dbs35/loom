# Seed corpus

This directory ships as the initial demo corpus for Practice Commons. It's plausible synthetic content, not real practitioner contributions — Andrea and other contributors replace it over time.

## Layout

- `initial-objects/<type>/<slug>.json` — 23 object scaffolds (10 programs, 5 papers, 5 questions, 3 specialists). Each file has the shape `{ canonical_name, aliases, frontmatter }`; the filename (without `.json`) is the slug; the directory name is the type.
- `interviews/01.md` through `05.md` — five synthetic interview transcripts. Each transcript mentions seeded objects by name and introduces two or three new objects so the new-object branch of the extraction pipeline gets exercised.
- `queries.md` — demo queries with notes on what each should produce against the seeded corpus. One query is deliberately out-of-corpus so the refusal path is demoable.

## Running the seed

```bash
pnpm seed
```

The seed script (`scripts/seed.ts`):

1. Upserts each scaffold into `objects` by `(type, slug)`. Existing rows have their `canonical_name`, `aliases`, and `frontmatter` refreshed; their `body` is left alone so a manually-edited body isn't clobbered.
2. For each interview transcript, checks whether a contribution with the exact same `raw_input` already exists. If yes, the interview is skipped. If no, the script calls `runExtraction({ source: "general" })`, which inserts the contribution, extracts mentions, creates new objects when needed, and synthesizes the affected non-specialist objects.

Re-running `pnpm seed` after the first run is a near no-op. Editing an interview transcript and re-running creates a new contribution with the new text; the old seeded contribution row stays in place.

## Notes

- Specialists are stub-only by design. The extraction prompt explicitly does not emit specialist-typed mentions, and the synthesis pipeline never runs on specialist rows. The three specialist scaffolds live as canonical-name + frontmatter only.
- Paper authors, journals, and DOIs are fictional. Replace with real values before launch.
