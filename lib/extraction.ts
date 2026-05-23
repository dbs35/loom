import "server-only";

import { getSupabase } from "./supabase";
import { callLLM } from "./llm";
import { synthesizeObject } from "./synthesis";
import type { ObjectType } from "./parsing";

export type ContributionSource = "per_page" | "general" | "voice_interview";

export interface ExtractionInput {
  raw_input: string;
  source: ContributionSource;
  page_context_type?: ObjectType | null;
  page_context_slug?: string | null;
  contribution_id?: string;
}

export interface AffectedObject {
  id: string;
  type: ObjectType;
  slug: string;
  canonical_name: string;
  text_fragment: string;
  is_new: boolean;
}

export interface ExtractionResult {
  contribution_id: string;
  affected_objects: AffectedObject[];
  malformed_response: boolean;
}

interface ExtractedMention {
  target_slug: string | null;
  type: ObjectType;
  is_new: boolean;
  canonical_name_if_new: string | null;
  text_fragment: string;
}

interface AliasIndexRow {
  id: string;
  type: ObjectType;
  slug: string;
  canonical_name: string;
  aliases: string[] | null;
}

function isObjectType(value: unknown): value is ObjectType {
  return (
    value === "program" ||
    value === "paper" ||
    value === "question" ||
    value === "specialist"
  );
}

function isValidMention(m: unknown): m is ExtractedMention {
  if (typeof m !== "object" || m === null) return false;
  const mm = m as Record<string, unknown>;
  if (!(typeof mm.target_slug === "string" || mm.target_slug === null)) return false;
  if (!isObjectType(mm.type)) return false;
  if (typeof mm.is_new !== "boolean") return false;
  if (
    !(typeof mm.canonical_name_if_new === "string" || mm.canonical_name_if_new === null)
  ) {
    return false;
  }
  if (typeof mm.text_fragment !== "string" || mm.text_fragment.trim().length === 0) {
    return false;
  }
  return true;
}

function extractJson(raw: string): unknown {
  const direct = tryParse(raw);
  if (direct !== undefined) return direct;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    const parsed = tryParse(fenced[1]);
    if (parsed !== undefined) return parsed;
  }

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const parsed = tryParse(raw.slice(start, end + 1));
    if (parsed !== undefined) return parsed;
  }

  return undefined;
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function parseExtractionResponse(raw: string): ExtractedMention[] | null {
  const parsed = extractJson(raw);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as { mentions?: unknown }).mentions)
  ) {
    return null;
  }
  const rawMentions = (parsed as { mentions: unknown[] }).mentions;
  return rawMentions.filter(isValidMention);
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatAliasIndex(rows: AliasIndexRow[]): string {
  if (rows.length === 0) return "(corpus is currently empty)";
  return rows
    .map((r) => {
      const aliases = (r.aliases ?? []).filter((a) => a.trim().length > 0);
      const aliasNote = aliases.length > 0 ? ` (aliases: ${aliases.join(", ")})` : "";
      return `- ${r.type}/${r.slug} — "${r.canonical_name}"${aliasNote}`;
    })
    .join("\n");
}

function formatPageContext(
  type: ObjectType | null | undefined,
  slug: string | null | undefined,
): string {
  if (!type || !slug) return "none";
  return `${type}/${slug}`;
}

async function generateUniqueSlug(
  type: ObjectType,
  baseName: string,
): Promise<string> {
  const supabase = getSupabase();
  const base = toSlug(baseName);
  if (base.length === 0) {
    throw new Error(`Cannot generate slug from canonical_name "${baseName}"`);
  }

  const { data, error } = await supabase
    .from("objects")
    .select("slug")
    .eq("type", type);

  if (error) throw error;

  const existing = new Set((data ?? []).map((r: { slug: string }) => r.slug));
  if (!existing.has(base)) return base;

  let n = 2;
  while (existing.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export async function runExtraction(
  input: ExtractionInput,
): Promise<ExtractionResult> {
  const supabase = getSupabase();

  const pageContextType = input.page_context_type ?? null;
  const pageContextSlug = input.page_context_slug ?? null;

  let contributionId = input.contribution_id ?? null;
  if (!contributionId) {
    const { data: inserted, error: insertErr } = await supabase
      .from("contributions")
      .insert({
        source: input.source,
        raw_input: input.raw_input,
        page_context_type: pageContextType,
        page_context_slug: pageContextSlug,
      })
      .select("id")
      .single();
    if (insertErr) throw insertErr;
    contributionId = (inserted as { id: string }).id;
  }

  const { data: aliasRows, error: aliasErr } = await supabase
    .from("objects")
    .select("id, type, slug, canonical_name, aliases");
  if (aliasErr) throw aliasErr;
  const aliasIndex = (aliasRows ?? []) as AliasIndexRow[];

  const variables = {
    alias_index: formatAliasIndex(aliasIndex),
    page_context: formatPageContext(pageContextType, pageContextSlug),
  };

  let mentions: ExtractedMention[] | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callLLM({
        prompt_name: "extraction",
        complexity: 5,
        variables,
        user_message: input.raw_input,
      });
      mentions = parseExtractionResponse(raw);
      if (mentions !== null) break;
    } catch (err) {
      if (attempt === 1) {
        console.error("[extraction] LLM call failed after retry", err);
      }
    }
  }

  if (mentions === null) {
    return {
      contribution_id: contributionId,
      affected_objects: [],
      malformed_response: true,
    };
  }

  const existingByTypeSlug = new Map<string, AliasIndexRow>();
  for (const row of aliasIndex) {
    existingByTypeSlug.set(`${row.type}/${row.slug}`, row);
  }

  const affected: AffectedObject[] = [];
  const synthesizeIds = new Set<string>();

  for (const m of mentions) {
    if (m.type === "specialist") continue;

    let objectId: string;
    let objectSlug: string;
    let objectCanonicalName: string;
    let isNew = false;

    if (m.is_new) {
      const canonical = m.canonical_name_if_new?.trim();
      if (!canonical) continue;
      const slug = await generateUniqueSlug(m.type, canonical);
      const { data: created, error: createErr } = await supabase
        .from("objects")
        .insert({
          type: m.type,
          slug,
          canonical_name: canonical,
        })
        .select("id, type, slug, canonical_name")
        .single();
      if (createErr) {
        console.error("[extraction] failed to create object", createErr);
        continue;
      }
      const row = created as {
        id: string;
        type: ObjectType;
        slug: string;
        canonical_name: string;
      };
      objectId = row.id;
      objectSlug = row.slug;
      objectCanonicalName = row.canonical_name;
      isNew = true;
      existingByTypeSlug.set(`${row.type}/${row.slug}`, {
        id: row.id,
        type: row.type,
        slug: row.slug,
        canonical_name: row.canonical_name,
        aliases: [],
      });
    } else {
      const slug = m.target_slug?.trim();
      if (!slug) continue;
      const existing = existingByTypeSlug.get(`${m.type}/${slug}`);
      if (!existing) {
        console.warn(
          `[extraction] mention referenced unknown object ${m.type}/${slug}, skipping`,
        );
        continue;
      }
      objectId = existing.id;
      objectSlug = existing.slug;
      objectCanonicalName = existing.canonical_name;
    }

    const { error: mentionErr } = await supabase.from("mentions").insert({
      object_id: objectId,
      contribution_id: contributionId,
      text_fragment: m.text_fragment.trim(),
    });
    if (mentionErr) {
      console.error("[extraction] failed to insert mention", mentionErr);
      continue;
    }

    affected.push({
      id: objectId,
      type: m.type,
      slug: objectSlug,
      canonical_name: objectCanonicalName,
      text_fragment: m.text_fragment.trim(),
      is_new: isNew,
    });
    synthesizeIds.add(objectId);
  }

  for (const id of synthesizeIds) {
    try {
      await synthesizeObject(id);
    } catch (err) {
      console.error(`[extraction] synthesis failed for ${id}`, err);
    }
  }

  return {
    contribution_id: contributionId,
    affected_objects: affected,
    malformed_response: false,
  };
}
