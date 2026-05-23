import "server-only";

import { getSupabase } from "./supabase";
import { runExtraction } from "./extraction";
import { flattenTranscript, type TranscriptTurn } from "./elevenlabs";
import type { ObjectType } from "./parsing";

interface VoiceSessionRow {
  page_context_type: ObjectType | null;
  page_context_slug: string | null;
}

export async function finalizeVoiceSession(
  sessionId: string,
  transcript: TranscriptTurn[],
): Promise<string | null> {
  const supabase = getSupabase();

  const { data: sessRaw, error: sessErr } = await supabase
    .from("voice_sessions")
    .select("page_context_type, page_context_slug")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessErr) throw sessErr;
  const sess = sessRaw as VoiceSessionRow | null;

  const rawInput = flattenTranscript(transcript);
  if (rawInput.trim().length === 0) {
    await supabase
      .from("voice_sessions")
      .update({
        status: "failed",
        last_error: "Empty transcript",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
    return null;
  }

  const { data: contrib, error: contribErr } = await supabase
    .from("contributions")
    .insert({
      source: "voice_interview",
      raw_input: rawInput,
      page_context_type: sess?.page_context_type ?? null,
      page_context_slug: sess?.page_context_slug ?? null,
    })
    .select("id")
    .single();
  if (contribErr) {
    console.error("[voice] contribution insert failed", contribErr);
    return null;
  }
  const contributionId = (contrib as { id: string }).id;

  try {
    await runExtraction({
      contribution_id: contributionId,
      raw_input: rawInput,
      source: "voice_interview",
      page_context_type: sess?.page_context_type ?? null,
      page_context_slug: sess?.page_context_slug ?? null,
    });
  } catch (err) {
    console.error("[voice] extraction failed", err);
  }

  await supabase
    .from("voice_sessions")
    .update({
      status: "completed",
      contribution_id: contributionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  return contributionId;
}
