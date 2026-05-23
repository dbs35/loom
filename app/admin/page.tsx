import Link from "next/link";

import { getSupabase } from "@/lib/supabase";
import type { ObjectType } from "@/lib/parsing";

export const dynamic = "force-dynamic";

interface ObjectRowWithCount {
  id: string;
  type: ObjectType;
  slug: string;
  canonical_name: string;
  last_synthesized_at: string | null;
  mention_count: number;
}

const TYPE_ORDER: ObjectType[] = ["program", "paper", "question", "specialist"];
const TYPE_LABEL: Record<ObjectType, string> = {
  program: "Programs",
  paper: "Papers",
  question: "Questions",
  specialist: "Specialists",
};

async function loadObjects(): Promise<ObjectRowWithCount[]> {
  const supabase = getSupabase();
  const { data: objectsRaw, error: objErr } = await supabase
    .from("objects")
    .select("id, type, slug, canonical_name, last_synthesized_at")
    .order("type", { ascending: true })
    .order("canonical_name", { ascending: true });
  if (objErr) throw objErr;

  const { data: mentionsRaw, error: mentionsErr } = await supabase
    .from("mentions")
    .select("object_id");
  if (mentionsErr) throw mentionsErr;

  const counts = new Map<string, number>();
  for (const m of (mentionsRaw ?? []) as { object_id: string }[]) {
    counts.set(m.object_id, (counts.get(m.object_id) ?? 0) + 1);
  }

  return ((objectsRaw ?? []) as Omit<ObjectRowWithCount, "mention_count">[]).map(
    (o) => ({ ...o, mention_count: counts.get(o.id) ?? 0 }),
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleString();
}

export default async function AdminIndexPage() {
  const objects = await loadObjects();

  const grouped = new Map<ObjectType, ObjectRowWithCount[]>();
  for (const t of TYPE_ORDER) grouped.set(t, []);
  for (const o of objects) grouped.get(o.type)?.push(o);

  return (
    <div>
      <div className="text-[11px] tracking-[0.22em] uppercase text-muted font-body mb-3">
        Objects
      </div>
      <h1 className="font-display text-[36px] font-normal tracking-[-0.015em] m-0 mb-8">
        All objects, grouped by type
      </h1>

      {TYPE_ORDER.map((type) => {
        const rows = grouped.get(type) ?? [];
        return (
          <section key={type} className="mb-10">
            <div className="flex items-baseline justify-between border-b border-ink pb-2 mb-3">
              <h2 className="font-display text-[22px] font-normal tracking-[-0.01em] m-0">
                {TYPE_LABEL[type]}
              </h2>
              <span className="text-[11px] tracking-[0.18em] uppercase text-muted font-body">
                {rows.length} {rows.length === 1 ? "object" : "objects"}
              </span>
            </div>
            {rows.length === 0 ? (
              <p className="text-[14px] text-muted font-body italic">
                None yet.
              </p>
            ) : (
              <table className="w-full font-body text-[14px] border-collapse">
                <thead>
                  <tr className="text-left text-[11px] tracking-[0.16em] uppercase text-muted">
                    <th className="py-2 border-b border-rule">Canonical name</th>
                    <th className="py-2 border-b border-rule">Slug</th>
                    <th className="py-2 border-b border-rule text-right">
                      {type === "specialist" ? "Status" : "Mentions"}
                    </th>
                    <th className="py-2 border-b border-rule">
                      Last synthesized
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id} className="border-b border-rule-soft">
                      <td className="py-2">
                        <Link
                          href={`/admin/object/${o.type}/${o.slug}`}
                          className="plain text-ink hover:text-accent underline decoration-rule"
                        >
                          {o.canonical_name}
                        </Link>
                      </td>
                      <td className="py-2 text-muted font-mono text-[12px]">
                        {o.slug}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {type === "specialist" ? "stub" : o.mention_count}
                      </td>
                      <td className="py-2 text-muted text-[12px]">
                        {formatDate(o.last_synthesized_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}
