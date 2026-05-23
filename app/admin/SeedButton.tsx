"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ScaffoldTypeResult {
  type: "program" | "paper" | "question" | "specialist";
  created: number;
  updated: number;
  total: number;
}

interface InterviewResult {
  name: string;
  status: "skipped" | "extracted";
  mentions?: number;
  malformed?: boolean;
}

interface SeedResult {
  scaffolds: ScaffoldTypeResult[];
  interviews: InterviewResult[];
}

export function SeedButton({ corpusEmpty }: { corpusEmpty: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SeedResult | null>(null);

  async function onClick() {
    if (
      !confirm(
        "Run the seed loader? This upserts the 23 object scaffolds and pushes each of the 5 seed interviews through extraction + synthesis. It calls Anthropic (LLM cost) and can take 2–5 minutes. Already-seeded interviews are skipped, so re-clicking is safe.",
      )
    ) {
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/seed", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Seed failed: ${res.status}`);
      }
      const data = (await res.json()) as { result: SeedResult };
      setResult(data.result);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seed failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section
      className={`mb-10 border ${
        corpusEmpty ? "border-accent" : "border-rule"
      } bg-bg-elev p-5`}
    >
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-2">
        <h2 className="font-display text-[20px] font-normal tracking-[-0.01em] m-0">
          {corpusEmpty ? "Corpus is empty" : "Seed loader"}
        </h2>
        <span className="text-[11px] tracking-[0.16em] uppercase text-muted font-body">
          {corpusEmpty ? "Setup" : "Maintenance"}
        </span>
      </div>
      <p className="text-[14px] text-muted font-body mb-4 max-w-[760px]">
        Upserts the 23 object scaffolds (Programs, Papers, Questions,
        Specialists), then pushes each of the 5 seed interviews through the
        live extraction + synthesis pipelines. Idempotent — already-seeded
        interviews are skipped. Costs Anthropic LLM calls; runs 2–5 minutes.
      </p>
      <button
        type="button"
        onClick={onClick}
        disabled={running}
        className="font-body text-[12px] tracking-[0.16em] uppercase px-[18px] py-[10px] bg-ink text-bg-elev border border-ink hover:bg-accent hover:border-accent disabled:opacity-50"
      >
        {running ? "Seeding (2–5 min)…" : corpusEmpty ? "Seed demo corpus" : "Re-run seed"}
      </button>
      {error ? (
        <p className="mt-3 text-[14px] text-accent font-body">{error}</p>
      ) : null}
      {result ? (
        <div className="mt-4 border-t border-rule pt-4 space-y-3 text-[13px] font-body">
          <div>
            <div className="text-[11px] tracking-[0.16em] uppercase text-muted mb-1">
              Scaffolds
            </div>
            <ul className="list-none p-0 m-0 font-mono text-[12px] text-ink">
              {result.scaffolds.map((s) => (
                <li key={s.type}>
                  {s.type.padEnd(11)} {s.created} created, {s.updated} updated (
                  {s.total} total)
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[11px] tracking-[0.16em] uppercase text-muted mb-1">
              Interviews
            </div>
            <ul className="list-none p-0 m-0 font-mono text-[12px] text-ink">
              {result.interviews.map((i) => (
                <li key={i.name}>
                  {i.name.padEnd(8)}{" "}
                  {i.status === "skipped"
                    ? "skipped (already seeded)"
                    : `${i.mentions} mentions${
                        i.malformed ? " (MALFORMED)" : ""
                      }`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
