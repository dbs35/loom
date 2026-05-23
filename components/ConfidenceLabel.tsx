import type { ConfidenceLevel } from "@/lib/parsing";

const STYLES: Record<ConfidenceLevel, string> = {
  "well-supported":
    "bg-tag-bg text-accent border-accent-soft",
  "single-source":
    "bg-bg-elev text-muted border-rule",
  contested:
    "bg-bg-elev text-ink border-ink",
};

interface Props {
  level: ConfidenceLevel;
}

export function ConfidenceLabel({ level }: Props) {
  return (
    <span
      className={`inline-block ml-[6px] text-[10px] uppercase tracking-[0.14em] font-body border px-[6px] py-[1px] align-middle whitespace-nowrap ${STYLES[level]}`}
    >
      {level}
    </span>
  );
}
