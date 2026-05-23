import Link from "next/link";

export type VoiceSessionStatus =
  | "in_progress"
  | "transcript_pending"
  | "completed"
  | "failed"
  | "abandoned";

export interface VoiceSessionRow {
  id: string;
  agent_id: string;
  conversation_id: string | null;
  status: VoiceSessionStatus;
  contribution_id: string | null;
  retry_count: number;
  last_error: string | null;
  created_at: string;
}

const STATUS_FILTERS: Array<{
  key: VoiceSessionStatus | "all";
  label: string;
}> = [
  { key: "all", label: "All" },
  { key: "in_progress", label: "In progress" },
  { key: "transcript_pending", label: "Pending" },
  { key: "completed", label: "Completed" },
  { key: "failed", label: "Failed" },
  { key: "abandoned", label: "Abandoned" },
];

const STATUS_COLOR: Record<VoiceSessionStatus, string> = {
  in_progress: "text-ink",
  transcript_pending: "text-accent-soft",
  completed: "text-muted",
  failed: "text-accent",
  abandoned: "text-muted",
};

function agentLabel(
  agentId: string,
  envGeneral: string | undefined,
  envPerPage: string | undefined,
): string {
  if (envGeneral && agentId === envGeneral) return "general";
  if (envPerPage && agentId === envPerPage) return "per-page";
  return agentId.slice(0, 12) + "…";
}

export function AdminVoiceSessionsList({
  sessions,
  filter,
  agentGeneral,
  agentPerPage,
}: {
  sessions: VoiceSessionRow[];
  filter: VoiceSessionStatus | "all";
  agentGeneral: string | undefined;
  agentPerPage: string | undefined;
}) {
  return (
    <div>
      <div className="text-[11px] tracking-[0.22em] uppercase text-muted font-body mb-3">
        Voice sessions
      </div>
      <h1 className="font-display text-[36px] font-normal tracking-[-0.015em] m-0 mb-6">
        ElevenLabs voice interview sessions
      </h1>

      <div className="flex gap-2 mb-6 text-[11px] tracking-[0.14em] uppercase font-body flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={
              f.key === "all"
                ? "/admin/voice-sessions"
                : `/admin/voice-sessions?filter=${f.key}`
            }
            className={`plain px-3 py-2 border ${
              filter === f.key
                ? "border-ink bg-ink text-bg-elev"
                : "border-rule text-muted hover:text-ink"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {sessions.length === 0 ? (
        <p className="text-[14px] text-muted font-body italic">
          No sessions match this filter.
        </p>
      ) : (
        <table className="w-full font-body text-[14px] border-collapse">
          <thead>
            <tr className="text-left text-[11px] tracking-[0.16em] uppercase text-muted">
              <th className="py-2 border-b border-rule">When</th>
              <th className="py-2 border-b border-rule">Agent</th>
              <th className="py-2 border-b border-rule">Status</th>
              <th className="py-2 border-b border-rule">Conversation</th>
              <th className="py-2 border-b border-rule">Contribution</th>
              <th className="py-2 border-b border-rule text-right">Retries</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-rule-soft align-top">
                <td className="py-2 text-muted text-[12px] whitespace-nowrap">
                  <Link
                    href={`/admin/voice-sessions/${s.id}`}
                    className="plain text-ink hover:text-accent"
                  >
                    {new Date(s.created_at).toLocaleString()}
                  </Link>
                </td>
                <td className="py-2 text-[12px] tracking-[0.14em] uppercase text-muted">
                  {agentLabel(s.agent_id, agentGeneral, agentPerPage)}
                </td>
                <td
                  className={`py-2 text-[12px] tracking-[0.14em] uppercase ${
                    STATUS_COLOR[s.status]
                  }`}
                >
                  {s.status.replace(/_/g, " ")}
                </td>
                <td className="py-2 text-muted text-[12px] font-mono">
                  {s.conversation_id ? s.conversation_id.slice(0, 16) + "…" : "—"}
                </td>
                <td className="py-2 text-[12px]">
                  {s.contribution_id ? (
                    <Link
                      href={`/admin/contributions/${s.contribution_id}`}
                      className="plain text-ink hover:text-accent underline decoration-rule"
                    >
                      view
                    </Link>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums">{s.retry_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
