import Link from "next/link";

import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface ContributionListRow {
  id: string;
  source: "per_page" | "general" | "voice_interview";
  raw_input: string;
  page_context_type: string | null;
  page_context_slug: string | null;
  created_at: string;
}

function preview(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 140 ? clean.slice(0, 140) + "…" : clean;
}

function sourceLabel(s: ContributionListRow["source"]): string {
  if (s === "per_page") return "Per-page";
  if (s === "voice_interview") return "Voice";
  return "General";
}

async function loadContributions() {
  const supabase = getSupabase();
  const { data: contribsRaw, error: cErr } = await supabase
    .from("contributions")
    .select(
      "id, source, raw_input, page_context_type, page_context_slug, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (cErr) throw cErr;
  const contribs = (contribsRaw ?? []) as ContributionListRow[];

  const ids = contribs.map((c) => c.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: mentionsRaw, error: mErr } = await supabase
      .from("mentions")
      .select("contribution_id")
      .in("contribution_id", ids);
    if (mErr) throw mErr;
    for (const m of (mentionsRaw ?? []) as { contribution_id: string }[]) {
      counts.set(m.contribution_id, (counts.get(m.contribution_id) ?? 0) + 1);
    }
  }
  return contribs.map((c) => ({ ...c, affected_count: counts.get(c.id) ?? 0 }));
}

export default async function AdminContributionsPage() {
  const contribs = await loadContributions();
  return (
    <div>
      <div className="text-[11px] tracking-[0.22em] uppercase text-muted font-body mb-3">
        Contributions
      </div>
      <h1 className="font-display text-[36px] font-normal tracking-[-0.015em] m-0 mb-8">
        All contributions
      </h1>
      {contribs.length === 0 ? (
        <p className="text-[14px] text-muted font-body italic">
          No contributions yet.
        </p>
      ) : (
        <table className="w-full font-body text-[14px] border-collapse">
          <thead>
            <tr className="text-left text-[11px] tracking-[0.16em] uppercase text-muted">
              <th className="py-2 border-b border-rule">When</th>
              <th className="py-2 border-b border-rule">Source</th>
              <th className="py-2 border-b border-rule">Preview</th>
              <th className="py-2 border-b border-rule">Page context</th>
              <th className="py-2 border-b border-rule text-right">
                Affected
              </th>
            </tr>
          </thead>
          <tbody>
            {contribs.map((c) => (
              <tr key={c.id} className="border-b border-rule-soft align-top">
                <td className="py-2 text-muted text-[12px] whitespace-nowrap">
                  {new Date(c.created_at).toLocaleString()}
                </td>
                <td className="py-2 text-[12px] tracking-[0.14em] uppercase text-muted">
                  {sourceLabel(c.source)}
                </td>
                <td className="py-2">
                  <Link
                    href={`/admin/contributions/${c.id}`}
                    className="plain text-ink hover:text-accent"
                  >
                    {preview(c.raw_input)}
                  </Link>
                </td>
                <td className="py-2 text-muted text-[12px] font-mono">
                  {c.page_context_type && c.page_context_slug
                    ? `${c.page_context_type}/${c.page_context_slug}`
                    : "—"}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {c.affected_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
