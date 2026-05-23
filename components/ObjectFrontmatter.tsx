interface Props {
  frontmatter: Record<string, unknown> | null | undefined;
}

function humanLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function valueDisplay(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function ObjectFrontmatter({ frontmatter }: Props) {
  const entries = Object.entries(frontmatter ?? {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );
  if (entries.length === 0) return null;
  return (
    <dl className="grid grid-cols-[180px_1fr] gap-x-8 gap-y-3 m-0 max-[560px]:grid-cols-1 max-[560px]:gap-y-1">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-[11px] tracking-[0.16em] uppercase text-muted font-body pt-[3px]">
            {humanLabel(k)}
          </dt>
          <dd className="text-[16px] text-ink m-0 font-body max-[560px]:mb-3">
            {valueDisplay(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
