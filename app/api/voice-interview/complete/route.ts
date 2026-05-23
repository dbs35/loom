import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";

import { getSupabase } from "@/lib/supabase";
import { getConversation, type TranscriptTurn } from "@/lib/elevenlabs";
import { finalizeVoiceSession } from "@/lib/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FAST_RETRY_DELAYS = [1_000, 2_000, 4_000, 7_000];
const SLOW_RETRY_DELAYS = [30_000, 60_000, 120_000, 180_000, 240_000];
const MAX_RETRY_COUNT = 9;

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

async function attemptFetch(
  conversationId: string,
): Promise<TranscriptTurn[] | null> {
  try {
    const data = await getConversation(conversationId);
    if (data.status === "done" && Array.isArray(data.transcript)) {
      return data.transcript;
    }
    return null;
  } catch (err) {
    console.error("[voice/complete] getConversation error", err);
    return null;
  }
}

async function pollForTranscript(
  conversationId: string,
  delays: readonly number[],
): Promise<TranscriptTurn[] | null> {
  for (const delay of delays) {
    await sleep(delay);
    const transcript = await attemptFetch(conversationId);
    if (transcript) return transcript;
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "body must be an object" },
      { status: 400 },
    );
  }
  const b = body as Record<string, unknown>;
  if (
    typeof b.session_id !== "string" ||
    typeof b.conversation_id !== "string"
  ) {
    return NextResponse.json(
      { error: "session_id and conversation_id required" },
      { status: 400 },
    );
  }
  const sessionId = b.session_id;
  const conversationId = b.conversation_id;

  const supabase = getSupabase();

  // Conditional update: only transition if currently in_progress. If zero rows
  // affected, another completion call has already run (or the session was
  // abandoned), and we exit cleanly.
  const { data: claimed, error: claimErr } = await supabase
    .from("voice_sessions")
    .update({
      conversation_id: conversationId,
      status: "transcript_pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("status", "in_progress")
    .select("id");
  if (claimErr) {
    return NextResponse.json({ error: claimErr.message }, { status: 500 });
  }
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ status: "already_processed" });
  }

  // Fast retry window (~14s)
  const fastTranscript = await pollForTranscript(
    conversationId,
    FAST_RETRY_DELAYS,
  );
  if (fastTranscript) {
    const contributionId = await finalizeVoiceSession(
      sessionId,
      fastTranscript,
    );
    if (contributionId) {
      return NextResponse.json({
        status: "completed",
        contribution_id: contributionId,
      });
    }
    return NextResponse.json({ status: "failed", session_id: sessionId });
  }

  // Slow retry window — runs after the response is sent
  after(async () => {
    try {
      const slowTranscript = await pollForTranscript(
        conversationId,
        SLOW_RETRY_DELAYS,
      );
      if (slowTranscript) {
        await finalizeVoiceSession(sessionId, slowTranscript);
        return;
      }
      const supabaseBg = getSupabase();
      await supabaseBg
        .from("voice_sessions")
        .update({
          status: "failed",
          last_error: "Transcript never became available",
          retry_count: MAX_RETRY_COUNT,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
    } catch (err) {
      console.error("[voice/complete] background retry failed", err);
    }
  });

  return NextResponse.json({
    status: "transcript_pending",
    session_id: sessionId,
  });
}
