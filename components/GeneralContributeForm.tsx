"use client";

import { useState, type FormEvent } from "react";

export function GeneralContributeForm() {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_input: text, source: "general" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Request failed: ${res.status}`);
      }
      const data = (await res.json()) as { contribution_id: string };
      window.location.href = `/thank-you?contribution_id=${data.contribution_id}`;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={16}
        placeholder="Paste a transcript, notes, or general thoughts about programs, papers, or questions you encounter…"
        className="w-full max-w-[760px] border border-rule bg-bg-elev p-4 font-body text-[16px] text-ink leading-[1.55] outline-none focus:border-accent block"
        disabled={submitting}
        required
      />
      {error ? (
        <p className="mt-3 text-[14px] text-accent font-body">{error}</p>
      ) : null}
      <div className="mt-4">
        <button
          type="submit"
          disabled={submitting || !text.trim()}
          className="font-body text-[13px] tracking-[0.16em] uppercase px-[22px] py-[14px] bg-ink text-bg-elev border border-ink hover:bg-accent hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Extracting…" : "Submit"}
        </button>
      </div>
      {submitting ? (
        <p className="mt-3 text-[12px] tracking-[0.14em] uppercase text-muted font-body">
          This can take 10–20 seconds while the system reads through your text.
        </p>
      ) : null}
    </form>
  );
}
