"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { VoiceSessionStatus } from "@/components/AdminVoiceSessionsList";

export function VoiceSessionActions({
  id,
  status,
  hasConversationId,
}: {
  id: string;
  status: VoiceSessionStatus;
  hasConversationId: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const canRetry =
    (status === "transcript_pending" || status === "failed") &&
    hasConversationId;
  const canAbandon = status === "in_progress" || status === "transcript_pending";

  async function callAction(
    path: string,
    label: string,
    confirmMsg: string,
    successMsg?: string,
  ) {
    if (!confirm(confirmMsg)) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(path, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `${label} failed: ${res.status}`);
      }
      if (successMsg) setInfo(successMsg);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label} failed`);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (
      !confirm(
        "Delete this voice session row? The associated contribution (if any) is unaffected.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/voice-sessions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Delete failed: ${res.status}`);
      }
      router.push("/admin/voice-sessions");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="font-display text-[22px] font-normal tracking-[-0.01em] m-0 mb-3 border-b border-ink pb-2">
        Actions
      </h2>
      <div className="flex gap-3 flex-wrap">
        {canRetry ? (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              callAction(
                `/api/admin/voice-sessions/${id}/retry`,
                "Retry",
                "Re-attempt the ElevenLabs transcript fetch? This can take 5–10 seconds.",
                "Retry attempted.",
              )
            }
            className="font-body text-[12px] tracking-[0.16em] uppercase px-[18px] py-[10px] border border-ink hover:bg-ink hover:text-bg-elev disabled:opacity-50"
          >
            {busy ? "Working…" : "Retry transcript fetch"}
          </button>
        ) : null}
        {canAbandon ? (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              callAction(
                `/api/admin/voice-sessions/${id}/abandon`,
                "Abandon",
                "Mark this session as abandoned? Use for stuck sessions that will never complete.",
              )
            }
            className="font-body text-[12px] tracking-[0.16em] uppercase px-[18px] py-[10px] border border-rule text-muted hover:text-ink disabled:opacity-50"
          >
            Mark abandoned
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="font-body text-[12px] tracking-[0.16em] uppercase px-[18px] py-[10px] border border-accent text-accent hover:bg-accent hover:text-bg-elev disabled:opacity-50"
        >
          Delete session row
        </button>
      </div>
      {error ? (
        <p className="mt-3 text-[14px] text-accent font-body">{error}</p>
      ) : null}
      {info ? (
        <p className="mt-3 text-[12px] text-muted font-body">{info}</p>
      ) : null}
    </section>
  );
}
