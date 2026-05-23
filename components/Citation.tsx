import Link from "next/link";

import type { ObjectType } from "@/lib/parsing";

const TYPE_TO_PATH: Record<ObjectType, string> = {
  program: "programs",
  paper: "papers",
  question: "questions",
  specialist: "specialists",
};

interface Props {
  type: ObjectType;
  slug: string;
  number: number;
  canonicalName?: string;
}

export function Citation({ type, slug, number, canonicalName }: Props) {
  return (
    <Link
      href={`/${TYPE_TO_PATH[type]}/${slug}`}
      title={canonicalName ?? `${type}/${slug}`}
      className="plain align-super text-[12px] mx-[2px] font-body text-accent border-b border-accent-soft hover:border-ink"
    >
      [{number}]
    </Link>
  );
}
