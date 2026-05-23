import { getSupabase } from "@/lib/supabase";
import {
  AdminVoiceSessionsList,
  type VoiceSessionRow,
  type VoiceSessionStatus,
} from "@/components/AdminVoiceSessionsList";

export const dynamic = "force-dynamic";

const VALID_STATUS: VoiceSessionStatus[] = [
  "in_progress",
  "transcript_pending",
  "completed",
  "failed",
  "abandoned",
];

async function loadSessions(
  filter: VoiceSessionStatus | "all",
): Promise<VoiceSessionRow[]> {
  const supabase = getSupabase();
  let q = supabase
    .from("voice_sessions")
    .select(
      "id, agent_id, conversation_id, status, contribution_id, retry_count, last_error, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter !== "all") q = q.eq("status", filter);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as VoiceSessionRow[];
}

export default async function AdminVoiceSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const sp = await searchParams;
  const filter: VoiceSessionStatus | "all" =
    sp.filter && VALID_STATUS.includes(sp.filter as VoiceSessionStatus)
      ? (sp.filter as VoiceSessionStatus)
      : "all";
  const sessions = await loadSessions(filter);
  return (
    <AdminVoiceSessionsList
      sessions={sessions}
      filter={filter}
      agentGeneral={process.env.ELEVENLABS_AGENT_GENERAL}
      agentPerPage={process.env.ELEVENLABS_AGENT_PER_PAGE}
    />
  );
}
