import "server-only";

import { getSupabase } from "./supabase";
import type { ObjectType } from "./parsing";

export interface ObjectRow {
  id: string;
  type: ObjectType;
  slug: string;
  canonical_name: string;
  aliases: string[];
  frontmatter: Record<string, unknown>;
  body: string;
  last_synthesized_at: string | null;
  created_at: string;
}

export interface AliasIndexEntry {
  id: string;
  type: ObjectType;
  slug: string;
  canonical_name: string;
  aliases: string[];
}

export async function getObjectByTypeAndSlug(
  type: ObjectType,
  slug: string,
): Promise<ObjectRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("objects")
    .select(
      "id, type, slug, canonical_name, aliases, frontmatter, body, last_synthesized_at, created_at",
    )
    .eq("type", type)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return (data as ObjectRow | null) ?? null;
}

export async function listObjectsByType(type: ObjectType): Promise<ObjectRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("objects")
    .select(
      "id, type, slug, canonical_name, aliases, frontmatter, body, last_synthesized_at, created_at",
    )
    .eq("type", type)
    .order("canonical_name", { ascending: true });

  if (error) throw error;
  return (data as ObjectRow[] | null) ?? [];
}

export async function getAliasIndex(): Promise<AliasIndexEntry[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("objects")
    .select("id, type, slug, canonical_name, aliases");

  if (error) throw error;
  return (data as AliasIndexEntry[] | null) ?? [];
}
