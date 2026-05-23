import { NextResponse, type NextRequest } from "next/server";

import { getSupabase } from "@/lib/supabase";
import { getConversation } from "@/lib/elevenlabs";
import { finalizeVoiceSession } from "@/lib/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ABANDON_AFTER_MS = 30 * 60 * 1000;
const FAIL_AFTER_MS = 2 * 60 * 60 * 1000;
const MAX_RETRY_COUNT = 9;

interface StaleSession {
  id: string;
  conversation_id: string | null;
  retry_count: number;
}

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const now = Date.now();
  const abandonCutoff = new Date(now - ABANDON_AFTER_MS).toISOString();
  const failCutoff = new Date(now - FAIL_AFTER_MS).toISOString();
  const nowIso = new Date().toISOString();

  // 1. in_progress sessions older than 30 min → abandoned
  const { data: abandonedRows } = await supabase
    .from("voice_sessions")
    .update({ status: "abandoned", updated_at: nowIso })
    .eq("status", "in_progress")
    .lt("updated_at", abandonCutoff)
    .select("id");
  const abandoned = abandonedRows?.length ?? 0;

  // 2. transcript_pending sessions older than 30 min with retry_count < MAX
  //    → re-attempt transcript fetch synchronously
  const { data: stale } = await supabase
    .from("voice_sessions")
    .select("id, conversation_id, retry_count")
    .eq("status", "transcript_pending")
    .lt("updated_at", abandonCutoff);

  let retriedSuccess = 0;
  let retriedMiss = 0;
  let retriedError = 0;
  for (const row of (stale ?? []) as StaleSession[]) {
    if (!row.conversation_id || row.retry_count >= MAX_RETRY_COUNT) continue;
    try {
      const data = await getConversation(row.conversation_id);
      if (data.status === "done" && Array.isArray(data.transcript)) {
        await finalizeVoiceSession(row.id, data.transcript);
        retriedSuccess += 1;
      } else {
        await supabase
          .from("voice_sessions")
          .update({
            retry_count: row.retry_count + 1,
            updated_at: nowIso,
          })
          .eq("id", row.id);
        retriedMiss += 1;
      }
    } catch (err) {
      console.error("[cron sweep] retry error for", row.id, err);
      retriedError += 1;
    }
  }

  // 3. transcript_pending sessions older than 2h → failed
  const { data: failedRows } = await supabase
    .from("voice_sessions")
    .update({
      status: "failed",
      last_error: "Sweep: transcript_pending too long",
      updated_at: nowIso,
    })
    .eq("status", "transcript_pending")
    .lt("updated_at", failCutoff)
    .select("id");
  const failed = failedRows?.length ?? 0;

  return NextResponse.json({
    abandoned,
    retried_success: retriedSuccess,
    retried_miss: retriedMiss,
    retried_error: retriedError,
    failed,
  });
}
