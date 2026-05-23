import "server-only";

import { getSupabase } from "./supabase";
import { callLLM } from "./llm";
import { extractCitedRefs } from "./parsing";
import type { ObjectType } from "./parsing";

export interface CitedObject {
  id: string;
  type: ObjectType;
  slug: string;
  canonical_name: string;
}

export interface ChatBarResult {
  answer_text: string;
  cited_objects: CitedObject[];
  was_refusal: boolean;
}

interface CorpusRow {
  type: ObjectType;
  slug: string;
  canonical_name: string;
  body: string;
}

const REFUSAL_PREFIX = "The bin doesn't cover this yet";

function formatCorpus(rows: CorpusRow[]): string {
  return rows
    .map(
      (r) =>
        `## ref: ${r.type}/${r.slug} — ${r.canonical_name}\n\n${r.body.trim()}`,
    )
    .join("\n\n---\n\n");
}

export async function runChatBar(queryText: string): Promise<ChatBarResult> {
  const supabase = getSupabase();

  const { data: corpusRaw, error: corpusErr } = await supabase
    .from("objects")
    .select("type, slug, canonical_name, body")
    .neq("body", "")
    .order("type", { ascending: true })
    .order("slug", { ascending: true });
  if (corpusErr) throw corpusErr;
  const corpus = (corpusRaw ?? []) as CorpusRow[];

  const answer = (
    await callLLM({
      prompt_name: "chat-bar",
      complexity: 8,
      variables: { corpus_block: formatCorpus(corpus) },
      user_message: queryText,
    })
  ).trim();

  const was_refusal = answer.startsWith(REFUSAL_PREFIX);

  let cited_objects: CitedObject[] = [];
  if (!was_refusal) {
    const refs = extractCitedRefs(answer);
    if (refs.length > 0) {
      const { data, error } = await supabase
        .from("objects")
        .select("id, type, slug, canonical_name")
        .in(
          "slug",
          refs.map((r) => r.slug),
        );
      if (error) throw error;
      const lookup = new Map<string, CitedObject>();
      for (const row of (data ?? []) as CitedObject[]) {
        lookup.set(`${row.type}/${row.slug}`, row);
      }
      const ordered: CitedObject[] = [];
      for (const ref of refs) {
        const obj = lookup.get(`${ref.type}/${ref.slug}`);
        if (obj) ordered.push(obj);
      }
      cited_objects = ordered;
    }
  }

  const { error: logErr } = await supabase.from("queries").insert({
    query_text: queryText,
    answer_text: answer,
    cited_object_ids: cited_objects.map((o) => o.id),
    was_refusal,
  });
  if (logErr) {
    console.error("[chatbar] failed to log query", logErr);
  }

  return { answer_text: answer, cited_objects, was_refusal };
}
