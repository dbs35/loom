import { NextResponse, type NextRequest } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getSupabase } from "@/lib/supabase";
import { getConversation, type TranscriptTurn } from "@/lib/elevenlabs";
import { finalizeVoiceSession } from "@/lib/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface SessionRow {
  id: string;
  conversation_id: string | null;
  status: string;
  retry_count: number;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const supabase = getSupabase();

  const { data: sessRaw, error: sessErr } = await supabase
    .from("voice_sessions")
    .select("id, conversation_id, status, retry_count")
    .eq("id", id)
    .maybeSingle();
  if (sessErr) {
    return NextResponse.json({ error: sessErr.message }, { status: 500 });
  }
  if (!sessRaw) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  const session = sessRaw as SessionRow;
  if (!session.conversation_id) {
    return NextResponse.json(
      { error: "Session has no conversation_id to retry against" },
      { status: 400 },
    );
  }
  if (session.status !== "transcript_pending" && session.status !== "failed") {
    return NextResponse.json(
      { error: `Cannot retry session in status "${session.status}"` },
      { status: 400 },
    );
  }

  let transcript: TranscriptTurn[] | null = null;
  let lastError: string | null = null;
  try {
    const data = await getConversation(session.conversation_id);
    if (data.status === "done" && Array.isArray(data.transcript)) {
      transcript = data.transcript;
    } else {
      lastError = `Conversation status from ElevenLabs: ${data.status}`;
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : "getConversation failed";
  }

  if (!transcript) {
    await supabase
      .from("voice_sessions")
      .update({
        retry_count: session.retry_count + 1,
        last_error: lastError ?? "Transcript not yet available",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    return NextResponse.json({
      status: "transcript_still_pending",
      last_error: lastError,
    });
  }

  await supabase
    .from("voice_sessions")
    .update({
      retry_count: session.retry_count + 1,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  const contributionId = await finalizeVoiceSession(id, transcript);
  if (!contributionId) {
    return NextResponse.json({ status: "failed" });
  }
  return NextResponse.json({
    status: "completed",
    contribution_id: contributionId,
  });
}
