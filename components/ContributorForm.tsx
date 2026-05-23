"use client";

import { useState, type FormEvent } from "react";

import type { ObjectType } from "@/lib/parsing";

interface Props {
  pageContextType: ObjectType;
  pageContextSlug: string;
  canonicalName: string;
}

export function ContributorForm({
  pageContextType,
  pageContextSlug,
  canonicalName,
}: Props) {
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
        body: JSON.stringify({
          raw_input: text,
          source: "per_page",
          page_context_type: pageContextType,
          page_context_slug: pageContextSlug,
        }),
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
      <div className="text-[11px] tracking-[0.22em] uppercase text-muted font-body mb-3">
        Contribute
      </div>
      <h2 className="font-display text-[28px] font-normal tracking-[-0.01em] m-0 mb-3">
        Add your thoughts about {canonicalName}
      </h2>
      <p className="text-ink-soft text-[15px] mb-6 max-w-[640px]">
        One paragraph or several. What you write will be folded into the page
        along with what others have shared. Raw text is never reproduced.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="What you know about this, what's changed recently, who it's a good fit for, what to ask…"
        className="w-full max-w-[760px] border border-rule bg-bg-elev p-4 font-body text-[16px] text-ink leading-[1.5] outline-none focus:border-accent block"
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
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </div>
    </form>
  );
}
