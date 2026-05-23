import Link from "next/link";

import { getSupabase } from "@/lib/supabase";
import type { ObjectType } from "@/lib/parsing";

export const dynamic = "force-dynamic";

interface QueryRow {
  id: string;
  query_text: string;
  answer_text: string;
  cited_object_ids: string[];
  was_refusal: boolean;
  created_at: string;
}

interface ObjectMini {
  id: string;
  type: ObjectType;
  slug: string;
  canonical_name: string;
}

type Filter = "all" | "answered" | "refusals";

async function loadQueries(filter: Filter) {
  const supabase = getSupabase();
  let query = supabase
    .from("queries")
    .select(
      "id, query_text, answer_text, cited_object_ids, was_refusal, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter === "refusals") query = query.eq("was_refusal", true);
  if (filter === "answered") query = query.eq("was_refusal", false);

  const { data: rowsRaw, error } = await query;
  if (error) throw error;
  const rows = (rowsRaw ?? []) as QueryRow[];

  const allObjectIds = new Set<string>();
  for (const r of rows) {
    for (const id of r.cited_object_ids ?? []) allObjectIds.add(id);
  }
  const objectMap = new Map<string, ObjectMini>();
  if (allObjectIds.size > 0) {
    const { data: objectsRaw, error: oErr } = await supabase
      .from("objects")
      .select("id, type, slug, canonical_name")
      .in("id", Array.from(allObjectIds));
    if (oErr) throw oErr;
    for (const o of (objectsRaw ?? []) as ObjectMini[]) {
      objectMap.set(o.id, o);
    }
  }
  return { rows, objectMap };
}

export default async function AdminQueriesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const sp = await searchParams;
  const filter: Filter =
    sp.filter === "refusals" || sp.filter === "answered"
      ? sp.filter
      : "all";
  const { rows, objectMap } = await loadQueries(filter);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "answered", label: "Answered" },
    { key: "refusals", label: "Refusals only" },
  ];

  return (
    <div>
      <div className="text-[11px] tracking-[0.22em] uppercase text-muted font-body mb-3">
        Queries
      </div>
      <h1 className="font-display text-[36px] font-normal tracking-[-0.015em] m-0 mb-6">
        Chat-bar query log
      </h1>

      <div className="flex gap-2 mb-6 text-[11px] tracking-[0.14em] uppercase font-body">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/admin/queries" : `/admin/queries?filter=${f.key}`}
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

      {rows.length === 0 ? (
        <p className="text-[14px] text-muted font-body italic">
          No queries match this filter.
        </p>
      ) : (
        <ul className="space-y-4 list-none p-0 m-0">
          {rows.map((q) => (
            <li key={q.id} className="border border-rule bg-bg-elev p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                <span className="text-[11px] tracking-[0.14em] uppercase text-muted font-body">
                  {new Date(q.created_at).toLocaleString()}
                </span>
                {q.was_refusal ? (
                  <span className="text-[11px] tracking-[0.14em] uppercase text-accent font-body">
                    Refusal
                  </span>
                ) : (
                  <span className="text-[11px] tracking-[0.14em] uppercase text-muted font-body">
                    {(q.cited_object_ids ?? []).length}{" "}
                    {(q.cited_object_ids ?? []).length === 1
                      ? "citation"
                      : "citations"}
                  </span>
                )}
              </div>
              <p className="font-display text-[18px] font-normal tracking-[-0.005em] m-0 mb-2 text-ink">
                {q.query_text}
              </p>
              <pre className="whitespace-pre-wrap font-body text-[14px] leading-[1.55] text-ink-soft m-0 mb-2">
                {q.answer_text}
              </pre>
              {(q.cited_object_ids ?? []).length > 0 ? (
                <div className="flex gap-2 flex-wrap text-[12px] font-body">
                  {(q.cited_object_ids ?? []).map((id) => {
                    const obj = objectMap.get(id);
                    if (!obj) {
                      return (
                        <span key={id} className="text-muted italic">
                          (deleted)
                        </span>
                      );
                    }
                    return (
                      <Link
                        key={id}
                        href={`/admin/object/${obj.type}/${obj.slug}`}
                        className="plain px-2 py-1 bg-tag-bg text-ink hover:bg-accent-soft hover:text-bg-elev"
                      >
                        {obj.type} · {obj.canonical_name}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
