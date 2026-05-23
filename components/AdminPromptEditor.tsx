"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { PromptName } from "@/lib/prompts";

export interface PromptEditorProps {
  name: PromptName;
  bundled: string;
  overrideText: string | null;
  overrideUpdatedAt: string | null;
}

export function AdminPromptEditor({
  name,
  bundled,
  overrideText,
  overrideUpdatedAt,
}: PromptEditorProps) {
  const initial = overrideText ?? bundled;
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const router = useRouter();

  const isOverride = overrideText !== null;
  const isDirty = text !== initial;

  async function onSave() {
    if (saving || reverting) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/admin/prompts/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ override_text: text }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Save failed: ${res.status}`);
      }
      setInfo("Override saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onRevert() {
    if (
      !confirm(
        "Revert to bundled default? The override will be deleted; bundled prompt text will be used.",
      )
    ) {
      return;
    }
    setReverting(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/admin/prompts/${name}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Revert failed: ${res.status}`);
      }
      setText(bundled);
      setInfo("Reverted to bundled default.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revert failed");
    } finally {
      setReverting(false);
    }
  }

  return (
    <section className="mb-12">
      <div className="flex items-baseline justify-between gap-3 flex-wrap border-b border-ink pb-2 mb-2">
        <h2 className="font-display text-[22px] font-normal tracking-[-0.01em] m-0">
          {name}
        </h2>
        <span className="text-[11px] tracking-[0.14em] uppercase text-muted font-body">
          Currently:{" "}
          {isOverride
            ? `override${
                overrideUpdatedAt
                  ? ` (last edited ${new Date(overrideUpdatedAt).toLocaleString()})`
                  : ""
              }`
            : "bundled default"}
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={20}
        className="w-full border border-rule bg-bg-elev p-3 font-mono text-[13px] text-ink leading-[1.5] outline-none focus:border-accent"
        spellCheck={false}
      />
      {error ? (
        <p className="mt-2 text-[14px] text-accent font-body">{error}</p>
      ) : null}
      {info ? (
        <p className="mt-2 text-[12px] text-muted font-body">{info}</p>
      ) : null}
      <div className="mt-3 flex gap-3 flex-wrap">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || reverting || !isDirty}
          className="font-body text-[12px] tracking-[0.16em] uppercase px-[18px] py-[10px] bg-ink text-bg-elev border border-ink hover:bg-accent hover:border-accent disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save override"}
        </button>
        <button
          type="button"
          onClick={onRevert}
          disabled={saving || reverting || !isOverride}
          className="font-body text-[12px] tracking-[0.16em] uppercase px-[18px] py-[10px] border border-rule text-muted hover:text-ink disabled:opacity-50"
        >
          {reverting ? "Reverting…" : "Revert to default"}
        </button>
      </div>
    </section>
  );
}
