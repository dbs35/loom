import "server-only";

import { getSupabase } from "./supabase";
import { callLLM } from "./llm";
import type { ObjectType } from "./parsing";

interface ObjectMetaRow {
  id: string;
  type: ObjectType;
  canonical_name: string;
  frontmatter: Record<string, unknown>;
}

interface MentionRow {
  text_fragment: string;
  created_at: string;
}

function formatMentionsBlock(mentions: MentionRow[]): string {
  return mentions
    .map((m, i) => `${i + 1}. ${m.text_fragment.trim()}`)
    .join("\n\n");
}

export async function synthesizeObject(objectId: string): Promise<void> {
  const supabase = getSupabase();

  const { data: objRaw, error: objErr } = await supabase
    .from("objects")
    .select("id, type, canonical_name, frontmatter")
    .eq("id", objectId)
    .single();
  if (objErr) throw objErr;
  const obj = objRaw as ObjectMetaRow;

  if (obj.type === "specialist") return;

  const { data: mentionsRaw, error: mentionsErr } = await supabase
    .from("mentions")
    .select("text_fragment, created_at")
    .eq("object_id", objectId)
    .order("created_at", { ascending: true });
  if (mentionsErr) throw mentionsErr;
  const mentions = (mentionsRaw ?? []) as MentionRow[];

  if (mentions.length === 0) {
    const { error: clearErr } = await supabase
      .from("objects")
      .update({ body: "", last_synthesized_at: new Date().toISOString() })
      .eq("id", objectId);
    if (clearErr) throw clearErr;
    return;
  }

  const threshold = process.env.WELL_SUPPORTED_THRESHOLD ?? "2";

  const body = await callLLM({
    prompt_name: "synthesis",
    complexity: 7,
    variables: {
      object_name: obj.canonical_name,
      object_type: obj.type,
      frontmatter_json: JSON.stringify(obj.frontmatter ?? {}, null, 2),
      mentions_block: formatMentionsBlock(mentions),
      well_supported_threshold: threshold,
    },
    user_message: `Synthesize the body for "${obj.canonical_name}" from the provided mentions.`,
  });

  const { error: updateErr } = await supabase
    .from("objects")
    .update({
      body: body.trim(),
      last_synthesized_at: new Date().toISOString(),
    })
    .eq("id", objectId);
  if (updateErr) throw updateErr;
}
