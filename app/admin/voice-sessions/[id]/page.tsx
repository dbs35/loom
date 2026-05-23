import Link from "next/link";
import { notFound } from "next/navigation";

import { getSupabase } from "@/lib/supabase";
import type { ObjectType } from "@/lib/parsing";
import { VoiceSessionActions } from "./VoiceSessionActions";
import type { VoiceSessionStatus } from "@/components/AdminVoiceSessionsList";

export const dynamic = "force-dynamic";

interface SessionRow {
  id: string;
  agent_id: string;
  conversation_id: string | null;
  page_context_type: ObjectType | null;
  page_context_slug: string | null;
  contributor_expertise: string | null;
  system_prompt: string;
  first_message: string | null;
  status: VoiceSessionStatus;
  contribution_id: string | null;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

async function loadSession(id: string): Promise<SessionRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("voice_sessions")
    .select(
      "id, agent_id, conversation_id, page_context_type, page_context_slug, contributor_expertise, system_prompt, first_message, status, contribution_id, retry_count, last_error, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as SessionRow | null) ?? null;
}

function agentLabel(agentId: string): string {
  if (process.env.ELEVENLABS_AGENT_GENERAL === agentId) return "general";
  if (process.env.ELEVENLABS_AGENT_PER_PAGE === agentId) return "per-page";
  return agentId;
}

export default async function AdminVoiceSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await loadSession(id);
  if (!session) notFound();

  return (
    <div className="space-y-10">
      <section>
        <div className="text-[11px] tracking-[0.22em] uppercase text-muted font-body mb-2">
          Voice session
        </div>
        <h1 className="font-display text-[32px] font-normal tracking-[-0.015em] m-0 mb-2">
          {new Date(session.created_at).toLocaleString()}
        </h1>
        <p className="text-[13px] text-muted font-body">
          ID: <span className="font-mono text-[12px]">{session.id}</span>
        </p>
      </section>

      <section className="grid grid-cols-2 gap-x-8 gap-y-3 max-[700px]:grid-cols-1 text-[14px] font-body">
        <Field label="Status">
          <span className="uppercase tracking-[0.14em] text-[12px]">
            {session.status.replace(/_/g, " ")}
          </span>
        </Field>
        <Field label="Agent">
          {agentLabel(session.agent_id)}{" "}
          <span className="font-mono text-[11px] text-muted">
            ({session.agent_id})
          </span>
        </Field>
        <Field label="Conversation ID">
          <span className="font-mono text-[12px]">
            {session.conversation_id ?? "—"}
          </span>
        </Field>
        <Field label="Updated">
          {new Date(session.updated_at).toLocaleString()}
        </Field>
        <Field label="Page context">
          {session.page_context_type && session.page_context_slug ? (
            <Link
              href={`/admin/object/${session.page_context_type}/${session.page_context_slug}`}
              className="plain text-ink hover:text-accent underline decoration-rule"
            >
              {session.page_context_type}/{session.page_context_slug}
            </Link>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Contribution">
          {session.contribution_id ? (
            <Link
              href={`/admin/contributions/${session.contribution_id}`}
              className="plain text-ink hover:text-accent underline decoration-rule"
            >
              view contribution
            </Link>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Retry count">{session.retry_count}</Field>
        <Field label="Contributor expertise">
          {session.contributor_expertise ?? "—"}
        </Field>
      </section>

      {session.last_error ? (
        <section className="border border-accent bg-bg-elev p-4">
          <div className="text-[11px] tracking-[0.18em] uppercase text-accent font-body mb-1">
            Last error
          </div>
          <pre className="whitespace-pre-wrap font-body text-[14px] text-ink m-0">
            {session.last_error}
          </pre>
        </section>
      ) : null}

      <VoiceSessionActions
        id={session.id}
        status={session.status}
        hasConversationId={!!session.conversation_id}
      />

      <section>
        <h2 className="font-display text-[22px] font-normal tracking-[-0.01em] m-0 mb-3 border-b border-ink pb-2">
          System prompt (snapshot)
        </h2>
        <pre className="whitespace-pre-wrap bg-bg-elev border border-rule p-4 font-body text-[13px] text-ink leading-[1.55] max-h-[480px] overflow-auto">
          {session.system_prompt}
        </pre>
      </section>

      {session.first_message ? (
        <section>
          <h2 className="font-display text-[22px] font-normal tracking-[-0.01em] m-0 mb-3 border-b border-ink pb-2">
            First message
          </h2>
          <p className="font-body text-[15px] text-ink leading-[1.55] m-0">
            {session.first_message}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] tracking-[0.16em] uppercase text-muted font-body mb-1">
        {label}
      </div>
      <div className="text-ink">{children}</div>
    </div>
  );
}
