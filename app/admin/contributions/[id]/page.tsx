import Link from "next/link";
import { notFound } from "next/navigation";

import { getSupabase } from "@/lib/supabase";
import type { ObjectType } from "@/lib/parsing";
import { ContributionActions } from "./ContributionActions";

export const dynamic = "force-dynamic";

interface ContribRow {
  id: string;
  source: "per_page" | "general" | "voice_interview";
  raw_input: string;
  page_context_type: ObjectType | null;
  page_context_slug: string | null;
  created_at: string;
}

interface MentionRow {
  id: string;
  text_fragment: string;
  created_at: string;
  objects: {
    id: string;
    type: ObjectType;
    slug: string;
    canonical_name: string;
  } | null;
}

function sourceLabel(s: ContribRow["source"]): string {
  if (s === "per_page") return "Per-page";
  if (s === "voice_interview") return "Voice interview";
  return "General";
}

async function loadContribution(id: string) {
  const supabase = getSupabase();
  const { data: contribRaw, error: cErr } = await supabase
    .from("contributions")
    .select(
      "id, source, raw_input, page_context_type, page_context_slug, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!contribRaw) return null;
  const contribution = contribRaw as ContribRow;

  const { data: mentionsRaw, error: mErr } = await supabase
    .from("mentions")
    .select(
      "id, text_fragment, created_at, objects(id, type, slug, canonical_name)",
    )
    .eq("contribution_id", id)
    .order("created_at", { ascending: true });
  if (mErr) throw mErr;
  const mentions = (mentionsRaw ?? []) as unknown as MentionRow[];

  type VoiceSessionMini = { id: string; status: string; agent_id: string };
  let voiceSession: VoiceSessionMini | null = null;
  if (contribution.source === "voice_interview") {
    const { data: vsRaw } = await supabase
      .from("voice_sessions")
      .select("id, status, agent_id")
      .eq("contribution_id", id)
      .maybeSingle();
    voiceSession = (vsRaw as VoiceSessionMini | null) ?? null;
  }

  return { contribution, mentions, voiceSession };
}

export default async function AdminContributionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const loaded = await loadContribution(id);
  if (!loaded) notFound();
  const { contribution, mentions, voiceSession } = loaded;

  return (
    <div className="space-y-10">
      <section>
        <div className="text-[11px] tracking-[0.22em] uppercase text-muted font-body mb-2">
          Contribution · {sourceLabel(contribution.source)}
        </div>
        <h1 className="font-display text-[32px] font-normal tracking-[-0.015em] m-0 mb-2">
          {new Date(contribution.created_at).toLocaleString()}
        </h1>
        <p className="text-[13px] text-muted font-body">
          ID:{" "}
          <span className="font-mono text-[12px]">{contribution.id}</span>
          {contribution.page_context_type && contribution.page_context_slug ? (
            <>
              {" "}
              · Page context:{" "}
              <Link
                href={`/admin/object/${contribution.page_context_type}/${contribution.page_context_slug}`}
                className="plain text-ink underline decoration-rule hover:text-accent"
              >
                {contribution.page_context_type}/{contribution.page_context_slug}
              </Link>
            </>
          ) : null}
          {voiceSession ? (
            <>
              {" "}
              · Voice session:{" "}
              <Link
                href={`/admin/voice-sessions/${voiceSession.id}`}
                className="plain text-ink underline decoration-rule hover:text-accent"
              >
                {voiceSession.status}
              </Link>
            </>
          ) : null}
        </p>
      </section>

      <ContributionActions id={contribution.id} />

      <section>
        <h2 className="font-display text-[22px] font-normal tracking-[-0.01em] m-0 mb-3 border-b border-ink pb-2">
          Raw input
        </h2>
        <pre className="whitespace-pre-wrap bg-bg-elev border border-rule p-4 font-body text-[14px] text-ink leading-[1.6]">
          {contribution.raw_input}
        </pre>
      </section>

      <section>
        <h2 className="font-display text-[22px] font-normal tracking-[-0.01em] m-0 mb-3 border-b border-ink pb-2">
          Affected objects ({mentions.length})
        </h2>
        {mentions.length === 0 ? (
          <p className="text-[14px] text-muted font-body italic">
            No mentions for this contribution. (Extraction may have failed or
            yielded no matches.)
          </p>
        ) : (
          <ul className="space-y-3 list-none p-0 m-0">
            {mentions.map((m) => (
              <li
                key={m.id}
                className="border border-rule bg-bg-elev p-4 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap text-[11px] tracking-[0.14em] uppercase text-muted font-body">
                  {m.objects ? (
                    <Link
                      href={`/admin/object/${m.objects.type}/${m.objects.slug}`}
                      className="plain text-ink hover:text-accent"
                    >
                      {m.objects.type} · {m.objects.canonical_name}
                    </Link>
                  ) : (
                    <span>(deleted object)</span>
                  )}
                </div>
                <p className="font-body text-[15px] leading-[1.55] text-ink m-0">
                  {m.text_fragment}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
