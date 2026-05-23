import "server-only";

import { getSupabase } from "./supabase";
import { synthesizeObject } from "./synthesis";
import { runExtraction } from "./extraction";
import type { ObjectType } from "./parsing";

interface ObjectRow {
  id: string;
  type: ObjectType;
  slug: string;
  canonical_name: string;
  aliases: string[] | null;
}

export async function updateObjectMeta(
  objectId: string,
  patch: {
    canonical_name?: string;
    aliases?: string[];
    frontmatter?: Record<string, unknown>;
  },
): Promise<void> {
  const supabase = getSupabase();
  const update: Record<string, unknown> = {};
  if (patch.canonical_name !== undefined) {
    update.canonical_name = patch.canonical_name;
  }
  if (patch.aliases !== undefined) {
    update.aliases = patch.aliases;
  }
  if (patch.frontmatter !== undefined) {
    update.frontmatter = patch.frontmatter;
  }
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase
    .from("objects")
    .update(update)
    .eq("id", objectId);
  if (error) throw error;
}

export async function regenerateObject(objectId: string): Promise<void> {
  await synthesizeObject(objectId);
}

export async function deleteMentionAndResynthesize(
  mentionId: string,
): Promise<void> {
  const supabase = getSupabase();
  const { data: mention, error: fetchErr } = await supabase
    .from("mentions")
    .select("object_id")
    .eq("id", mentionId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!mention) return;
  const objectId = (mention as { object_id: string }).object_id;

  const { error: delErr } = await supabase
    .from("mentions")
    .delete()
    .eq("id", mentionId);
  if (delErr) throw delErr;

  await synthesizeObject(objectId);
}

export async function deleteObject(objectId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("objects").delete().eq("id", objectId);
  if (error) throw error;
}

function dedupeAliases(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const trimmed = v.trim();
    if (trimmed.length === 0) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export async function mergeObjects(
  sourceId: string,
  targetId: string,
): Promise<void> {
  if (sourceId === targetId) {
    throw new Error("Cannot merge an object into itself");
  }
  const supabase = getSupabase();

  const { data: rowsRaw, error: fetchErr } = await supabase
    .from("objects")
    .select("id, type, slug, canonical_name, aliases")
    .in("id", [sourceId, targetId]);
  if (fetchErr) throw fetchErr;
  const rows = (rowsRaw ?? []) as ObjectRow[];
  const source = rows.find((r) => r.id === sourceId);
  const target = rows.find((r) => r.id === targetId);
  if (!source) throw new Error("Source object not found");
  if (!target) throw new Error("Target object not found");
  if (source.type !== target.type) {
    throw new Error("Merge requires both objects to share the same type");
  }

  const { error: repointErr } = await supabase
    .from("mentions")
    .update({ object_id: targetId })
    .eq("object_id", sourceId);
  if (repointErr) throw repointErr;

  const merged = dedupeAliases([
    ...(target.aliases ?? []),
    source.canonical_name,
    ...(source.aliases ?? []),
  ]);

  const { error: aliasErr } = await supabase
    .from("objects")
    .update({ aliases: merged })
    .eq("id", targetId);
  if (aliasErr) throw aliasErr;

  const { error: deleteErr } = await supabase
    .from("objects")
    .delete()
    .eq("id", sourceId);
  if (deleteErr) throw deleteErr;

  await synthesizeObject(targetId);
}

interface ContributionRow {
  id: string;
  source: "per_page" | "general" | "voice_interview";
  raw_input: string;
  page_context_type: ObjectType | null;
  page_context_slug: string | null;
}

export async function rerunExtraction(contributionId: string): Promise<void> {
  const supabase = getSupabase();

  const { data: contribRaw, error: contribErr } = await supabase
    .from("contributions")
    .select("id, source, raw_input, page_context_type, page_context_slug")
    .eq("id", contributionId)
    .maybeSingle();
  if (contribErr) throw contribErr;
  if (!contribRaw) throw new Error("Contribution not found");
  const contrib = contribRaw as ContributionRow;

  const { data: priorRaw, error: priorErr } = await supabase
    .from("mentions")
    .select("object_id")
    .eq("contribution_id", contributionId);
  if (priorErr) throw priorErr;
  const priorObjectIds = new Set(
    (priorRaw ?? []).map((r: { object_id: string }) => r.object_id),
  );

  const { error: delErr } = await supabase
    .from("mentions")
    .delete()
    .eq("contribution_id", contributionId);
  if (delErr) throw delErr;

  const result = await runExtraction({
    contribution_id: contributionId,
    raw_input: contrib.raw_input,
    source: contrib.source,
    page_context_type: contrib.page_context_type,
    page_context_slug: contrib.page_context_slug,
  });

  const newAffected = new Set(result.affected_objects.map((o) => o.id));
  for (const objectId of priorObjectIds) {
    if (newAffected.has(objectId)) continue;
    try {
      await synthesizeObject(objectId);
    } catch (err) {
      console.error(`[admin] post-rerun resynthesis failed for ${objectId}`, err);
    }
  }
}

export async function deleteContribution(contributionId: string): Promise<void> {
  const supabase = getSupabase();

  const { data: priorRaw, error: priorErr } = await supabase
    .from("mentions")
    .select("object_id")
    .eq("contribution_id", contributionId);
  if (priorErr) throw priorErr;
  const priorObjectIds = Array.from(
    new Set((priorRaw ?? []).map((r: { object_id: string }) => r.object_id)),
  );

  const { error: delErr } = await supabase
    .from("contributions")
    .delete()
    .eq("id", contributionId);
  if (delErr) throw delErr;

  for (const id of priorObjectIds) {
    try {
      await synthesizeObject(id);
    } catch (err) {
      console.error(`[admin] post-delete resynthesis failed for ${id}`, err);
    }
  }
}
