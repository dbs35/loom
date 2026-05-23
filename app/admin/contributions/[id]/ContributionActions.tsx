"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ContributionActions({ id }: { id: string }) {
  const router = useRouter();
  const [rerunning, setRerunning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onRerun() {
    if (
      !confirm(
        "Re-run extraction on this contribution? Existing mentions for this contribution will be deleted, then the extraction pipeline runs again against the stored raw input.",
      )
    ) {
      return;
    }
    setRerunning(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/contributions/${id}/rerun`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Re-run failed: ${res.status}`);
      }
      setSuccess("Extraction re-run complete.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-run failed");
    } finally {
      setRerunning(false);
    }
  }

  async function onDelete() {
    if (
      !confirm(
        "Delete this contribution and all its mentions? Affected objects will be re-synthesized from their remaining mentions.",
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/contributions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Delete failed: ${res.status}`);
      }
      router.push("/admin/contributions");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  }

  return (
    <section>
      <div className="flex gap-3 flex-wrap">
        <button
          type="button"
          onClick={onRerun}
          disabled={rerunning || deleting}
          className="font-body text-[12px] tracking-[0.16em] uppercase px-[18px] py-[10px] border border-ink hover:bg-ink hover:text-bg-elev disabled:opacity-50"
        >
          {rerunning ? "Re-running…" : "Re-run extraction"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={rerunning || deleting}
          className="font-body text-[12px] tracking-[0.16em] uppercase px-[18px] py-[10px] border border-accent text-accent hover:bg-accent hover:text-bg-elev disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete contribution"}
        </button>
      </div>
      {error ? (
        <p className="mt-3 text-[14px] text-accent font-body">{error}</p>
      ) : null}
      {success ? (
        <p className="mt-3 text-[12px] text-muted font-body">{success}</p>
      ) : null}
    </section>
  );
}
