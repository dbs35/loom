"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type { ObjectType } from "@/lib/parsing";

export interface AdminMention {
  id: string;
  text_fragment: string;
  created_at: string;
  contribution_id: string;
  contribution_source: "per_page" | "general" | "voice_interview";
}

export interface MergeCandidate {
  id: string;
  canonical_name: string;
  slug: string;
  mention_count: number;
}

export interface AdminObjectEditorProps {
  id: string;
  type: ObjectType;
  slug: string;
  canonical_name: string;
  aliases: string[];
  frontmatter: Record<string, unknown>;
  body: string;
  last_synthesized_at: string | null;
  mentions: AdminMention[];
  merge_candidates: MergeCandidate[];
}

interface FrontmatterField {
  key: string;
  value: string;
}

function frontmatterToFields(fm: Record<string, unknown>): FrontmatterField[] {
  return Object.entries(fm).map(([key, value]) => ({
    key,
    value:
      value === null || value === undefined
        ? ""
        : typeof value === "string"
          ? value
          : JSON.stringify(value),
  }));
}

function fieldsToFrontmatter(
  fields: FrontmatterField[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const key = f.key.trim();
    if (key.length === 0) continue;
    const raw = f.value.trim();
    if (raw.length === 0) {
      out[key] = "";
      continue;
    }
    if (raw === "true" || raw === "false") {
      out[key] = raw === "true";
      continue;
    }
    if (/^-?\d+(\.\d+)?$/.test(raw)) {
      out[key] = Number(raw);
      continue;
    }
    if (raw.startsWith("[") || raw.startsWith("{")) {
      try {
        out[key] = JSON.parse(raw);
        continue;
      } catch {
        /* fall through to string */
      }
    }
    out[key] = raw;
  }
  return out;
}

function formatDate(value: string | null): string {
  if (!value) return "never";
  return new Date(value).toLocaleString();
}

function sourceLabel(
  source: "per_page" | "general" | "voice_interview",
): string {
  return source === "per_page"
    ? "Per-page"
    : source === "voice_interview"
      ? "Voice"
      : "General";
}

export function AdminObjectEditor(props: AdminObjectEditorProps) {
  const router = useRouter();
  const [canonicalName, setCanonicalName] = useState(props.canonical_name);
  const [aliasesText, setAliasesText] = useState(props.aliases.join("\n"));
  const [fields, setFields] = useState<FrontmatterField[]>(
    frontmatterToFields(props.frontmatter),
  );
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaSuccess, setMetaSuccess] = useState(false);

  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  const [mergeTargetId, setMergeTargetId] = useState("");
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isSpecialist = props.type === "specialist";

  const mentionsSorted = useMemo(
    () =>
      [...props.mentions].sort((a, b) =>
        a.created_at < b.created_at ? -1 : 1,
      ),
    [props.mentions],
  );

  async function onSaveMeta(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (savingMeta) return;
    setSavingMeta(true);
    setMetaError(null);
    setMetaSuccess(false);
    try {
      const aliases = aliasesText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const frontmatter = fieldsToFrontmatter(fields);
      const res = await fetch(`/api/admin/objects/${props.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonical_name: canonicalName.trim(),
          aliases,
          frontmatter,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Save failed: ${res.status}`);
      }
      setMetaSuccess(true);
      router.refresh();
    } catch (err) {
      setMetaError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingMeta(false);
    }
  }

  async function onRegenerate() {
    if (regenerating) return;
    setRegenerating(true);
    setRegenError(null);
    try {
      const res = await fetch(
        `/api/admin/objects/${props.id}/regenerate`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Regenerate failed: ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : "Regenerate failed");
    } finally {
      setRegenerating(false);
    }
  }

  async function onDeleteMention(mentionId: string) {
    if (
      !confirm(
        "Delete this mention? The object will be re-synthesized from its remaining mentions.",
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/mentions/${mentionId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Delete failed: ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function onMerge() {
    if (!mergeTargetId || merging) return;
    const target = props.merge_candidates.find((c) => c.id === mergeTargetId);
    if (!target) return;
    if (
      !confirm(
        `Merge "${props.canonical_name}" (${props.mentions.length} mentions) into "${target.canonical_name}" (${target.mention_count} mentions)? This repoints all mentions, folds aliases, then deletes "${props.canonical_name}".`,
      )
    ) {
      return;
    }
    setMerging(true);
    setMergeError(null);
    try {
      const res = await fetch(`/api/admin/objects/${props.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: mergeTargetId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Merge failed: ${res.status}`);
      }
      const data = (await res.json()) as {
        target: { type: ObjectType; slug: string };
      };
      router.push(`/admin/object/${data.target.type}/${data.target.slug}`);
      router.refresh();
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : "Merge failed");
      setMerging(false);
    }
  }

  async function onDeleteObject() {
    if (
      !confirm(
        `Delete "${props.canonical_name}"? This removes the object and all ${props.mentions.length} of its mentions. Use Merge instead if a canonical equivalent exists.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/objects/${props.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Delete failed: ${res.status}`);
      }
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-12">
      <section>
        <div className="text-[11px] tracking-[0.22em] uppercase text-muted font-body mb-2">
          {props.type} · {props.slug}
        </div>
        <h1 className="font-display text-[36px] font-normal tracking-[-0.015em] m-0 mb-2">
          {props.canonical_name}
        </h1>
        <p className="text-[12px] text-muted font-body">
          Last synthesized: {formatDate(props.last_synthesized_at)}
        </p>
      </section>

      <section>
        <h2 className="font-display text-[22px] font-normal tracking-[-0.01em] m-0 mb-4 border-b border-ink pb-2">
          Frontmatter
        </h2>
        <form onSubmit={onSaveMeta} className="space-y-4">
          <label className="block">
            <span className="block text-[11px] tracking-[0.18em] uppercase text-muted font-body mb-1">
              Canonical name
            </span>
            <input
              type="text"
              value={canonicalName}
              onChange={(e) => setCanonicalName(e.target.value)}
              className="w-full max-w-[600px] border border-rule bg-bg-elev p-2 font-body text-[15px] text-ink outline-none focus:border-accent"
              required
            />
          </label>
          <label className="block">
            <span className="block text-[11px] tracking-[0.18em] uppercase text-muted font-body mb-1">
              Aliases (one per line)
            </span>
            <textarea
              value={aliasesText}
              onChange={(e) => setAliasesText(e.target.value)}
              rows={4}
              className="w-full max-w-[600px] border border-rule bg-bg-elev p-2 font-body text-[14px] text-ink outline-none focus:border-accent"
            />
          </label>
          <div>
            <div className="text-[11px] tracking-[0.18em] uppercase text-muted font-body mb-2">
              Frontmatter fields
            </div>
            <div className="space-y-2">
              {fields.length === 0 ? (
                <p className="text-[13px] text-muted italic font-body">
                  No frontmatter fields. Add one below.
                </p>
              ) : null}
              {fields.map((f, i) => (
                <div key={i} className="flex gap-2 items-start flex-wrap">
                  <input
                    type="text"
                    value={f.key}
                    onChange={(e) => {
                      const next = [...fields];
                      next[i] = { ...next[i], key: e.target.value };
                      setFields(next);
                    }}
                    placeholder="key"
                    className="border border-rule bg-bg-elev p-2 font-mono text-[13px] text-ink outline-none focus:border-accent w-[180px]"
                  />
                  <input
                    type="text"
                    value={f.value}
                    onChange={(e) => {
                      const next = [...fields];
                      next[i] = { ...next[i], value: e.target.value };
                      setFields(next);
                    }}
                    placeholder="value"
                    className="flex-1 min-w-[260px] border border-rule bg-bg-elev p-2 font-body text-[14px] text-ink outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFields(fields.filter((_, idx) => idx !== i))
                    }
                    className="text-[11px] tracking-[0.16em] uppercase text-muted hover:text-accent font-body px-2 py-2 border border-rule"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setFields([...fields, { key: "", value: "" }])}
              className="mt-3 text-[11px] tracking-[0.16em] uppercase text-muted hover:text-ink font-body px-3 py-2 border border-rule"
            >
              + Add field
            </button>
          </div>
          {metaError ? (
            <p className="text-[14px] text-accent font-body">{metaError}</p>
          ) : null}
          {metaSuccess ? (
            <p className="text-[12px] text-muted font-body">Saved.</p>
          ) : null}
          <div>
            <button
              type="submit"
              disabled={savingMeta}
              className="font-body text-[12px] tracking-[0.16em] uppercase px-[18px] py-[10px] bg-ink text-bg-elev border border-ink hover:bg-accent hover:border-accent disabled:opacity-50"
            >
              {savingMeta ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </section>

      {isSpecialist ? null : (
        <section>
          <div className="flex items-baseline justify-between border-b border-ink pb-2 mb-3 gap-3 flex-wrap">
            <h2 className="font-display text-[22px] font-normal tracking-[-0.01em] m-0">
              Synthesized body
            </h2>
            <button
              type="button"
              onClick={onRegenerate}
              disabled={regenerating}
              className="font-body text-[11px] tracking-[0.16em] uppercase px-3 py-2 border border-ink hover:bg-ink hover:text-bg-elev disabled:opacity-50"
            >
              {regenerating ? "Regenerating…" : "Regenerate synthesis"}
            </button>
          </div>
          {regenError ? (
            <p className="text-[14px] text-accent font-body mb-2">
              {regenError}
            </p>
          ) : null}
          <pre className="whitespace-pre-wrap bg-bg-elev border border-rule p-4 font-body text-[15px] text-ink leading-[1.6]">
            {props.body || "(empty — no mentions yet)"}
          </pre>
        </section>
      )}

      <section>
        <h2 className="font-display text-[22px] font-normal tracking-[-0.01em] m-0 mb-3 border-b border-ink pb-2">
          Mentions ({mentionsSorted.length})
        </h2>
        {mentionsSorted.length === 0 ? (
          <p className="text-[14px] text-muted font-body italic">
            No mentions yet.
          </p>
        ) : (
          <ul className="space-y-3 list-none p-0 m-0">
            {mentionsSorted.map((m) => (
              <li
                key={m.id}
                className="border border-rule bg-bg-elev p-4 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap text-[11px] tracking-[0.14em] uppercase text-muted font-body">
                  <span>
                    {sourceLabel(m.contribution_source)} ·{" "}
                    {formatDate(m.created_at)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteMention(m.id)}
                    className="text-muted hover:text-accent"
                  >
                    Delete mention
                  </button>
                </div>
                <p className="font-body text-[15px] leading-[1.55] text-ink m-0">
                  {m.text_fragment}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {props.merge_candidates.length === 0 ? null : (
        <section>
          <h2 className="font-display text-[22px] font-normal tracking-[-0.01em] m-0 mb-3 border-b border-ink pb-2">
            Merge into another {props.type}
          </h2>
          <p className="text-[14px] text-muted font-body mb-3">
            Choose the canonical target. All mentions repoint, aliases fold in,
            then this object is deleted.
          </p>
          <div className="flex gap-2 items-center flex-wrap">
            <select
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(e.target.value)}
              className="border border-rule bg-bg-elev p-2 font-body text-[14px] text-ink outline-none focus:border-accent min-w-[280px]"
            >
              <option value="">Select target…</option>
              {props.merge_candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.canonical_name} ({c.mention_count}{" "}
                  {c.mention_count === 1 ? "mention" : "mentions"})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onMerge}
              disabled={!mergeTargetId || merging}
              className="font-body text-[12px] tracking-[0.16em] uppercase px-[18px] py-[10px] border border-accent text-accent hover:bg-accent hover:text-bg-elev disabled:opacity-50"
            >
              {merging ? "Merging…" : "Merge"}
            </button>
          </div>
          {mergeError ? (
            <p className="mt-3 text-[14px] text-accent font-body">
              {mergeError}
            </p>
          ) : null}
        </section>
      )}

      <section>
        <h2 className="font-display text-[22px] font-normal tracking-[-0.01em] m-0 mb-3 border-b border-ink pb-2 text-accent">
          Danger zone
        </h2>
        <p className="text-[14px] text-muted font-body mb-3">
          Deletes the object and all its mentions. Use Merge first if a
          canonical equivalent exists.
        </p>
        <button
          type="button"
          onClick={onDeleteObject}
          disabled={deleting}
          className="font-body text-[12px] tracking-[0.16em] uppercase px-[18px] py-[10px] border border-accent text-accent hover:bg-accent hover:text-bg-elev disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete object"}
        </button>
        {deleteError ? (
          <p className="mt-3 text-[14px] text-accent font-body">
            {deleteError}
          </p>
        ) : null}
      </section>
    </div>
  );
}
