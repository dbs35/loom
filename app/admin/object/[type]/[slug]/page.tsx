import { notFound } from "next/navigation";

import { getSupabase } from "@/lib/supabase";
import {
  AdminObjectEditor,
  type AdminMention,
  type MergeCandidate,
} from "@/components/AdminObjectEditor";
import type { ObjectType } from "@/lib/parsing";

export const dynamic = "force-dynamic";

const VALID_TYPES: ObjectType[] = ["program", "paper", "question", "specialist"];

interface ObjectRow {
  id: string;
  type: ObjectType;
  slug: string;
  canonical_name: string;
  aliases: string[] | null;
  frontmatter: Record<string, unknown> | null;
  body: string;
  last_synthesized_at: string | null;
}

interface MentionJoinRow {
  id: string;
  text_fragment: string;
  created_at: string;
  contribution_id: string;
  contributions: { source: "per_page" | "general" | "voice_interview" } | null;
}

interface CandidateRow {
  id: string;
  canonical_name: string;
  slug: string;
}

async function loadObject(
  type: ObjectType,
  slug: string,
): Promise<{
  object: ObjectRow;
  mentions: AdminMention[];
  candidates: MergeCandidate[];
} | null> {
  const supabase = getSupabase();
  const { data: objRaw, error: objErr } = await supabase
    .from("objects")
    .select(
      "id, type, slug, canonical_name, aliases, frontmatter, body, last_synthesized_at",
    )
    .eq("type", type)
    .eq("slug", slug)
    .maybeSingle();
  if (objErr) throw objErr;
  if (!objRaw) return null;
  const object = objRaw as ObjectRow;

  const { data: mentionsRaw, error: mErr } = await supabase
    .from("mentions")
    .select(
      "id, text_fragment, created_at, contribution_id, contributions(source)",
    )
    .eq("object_id", object.id)
    .order("created_at", { ascending: true });
  if (mErr) throw mErr;
  const mentions: AdminMention[] = ((mentionsRaw ?? []) as unknown as MentionJoinRow[]).map(
    (m) => ({
      id: m.id,
      text_fragment: m.text_fragment,
      created_at: m.created_at,
      contribution_id: m.contribution_id,
      contribution_source: m.contributions?.source ?? "general",
    }),
  );

  const { data: candidatesRaw, error: cErr } = await supabase
    .from("objects")
    .select("id, canonical_name, slug")
    .eq("type", type)
    .neq("id", object.id)
    .order("canonical_name", { ascending: true });
  if (cErr) throw cErr;
  const candidateRows = (candidatesRaw ?? []) as CandidateRow[];

  const candidateIds = candidateRows.map((c) => c.id);
  const candidateCounts = new Map<string, number>();
  if (candidateIds.length > 0) {
    const { data: countsRaw, error: countErr } = await supabase
      .from("mentions")
      .select("object_id")
      .in("object_id", candidateIds);
    if (countErr) throw countErr;
    for (const row of (countsRaw ?? []) as { object_id: string }[]) {
      candidateCounts.set(
        row.object_id,
        (candidateCounts.get(row.object_id) ?? 0) + 1,
      );
    }
  }

  const candidates: MergeCandidate[] = candidateRows.map((c) => ({
    id: c.id,
    canonical_name: c.canonical_name,
    slug: c.slug,
    mention_count: candidateCounts.get(c.id) ?? 0,
  }));

  return { object, mentions, candidates };
}

export default async function AdminObjectPage({
  params,
}: {
  params: Promise<{ type: string; slug: string }>;
}) {
  const { type, slug } = await params;
  if (!VALID_TYPES.includes(type as ObjectType)) notFound();
  const loaded = await loadObject(type as ObjectType, slug);
  if (!loaded) notFound();

  return (
    <AdminObjectEditor
      id={loaded.object.id}
      type={loaded.object.type}
      slug={loaded.object.slug}
      canonical_name={loaded.object.canonical_name}
      aliases={loaded.object.aliases ?? []}
      frontmatter={loaded.object.frontmatter ?? {}}
      body={loaded.object.body}
      last_synthesized_at={loaded.object.last_synthesized_at}
      mentions={loaded.mentions}
      merge_candidates={loaded.candidates}
    />
  );
}
