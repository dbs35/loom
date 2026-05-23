import Link from "next/link";

import type { ObjectType } from "@/lib/parsing";

interface IndexEntry {
  slug: string;
  canonical_name: string;
}

interface Props {
  type: ObjectType;
  title: string;
  description: string;
  items: IndexEntry[];
}

const TYPE_TO_PATH: Record<ObjectType, string> = {
  program: "programs",
  paper: "papers",
  question: "questions",
  specialist: "specialists",
};

export function IndexList({ type, title, description, items }: Props) {
  const path = TYPE_TO_PATH[type];
  return (
    <div className="wrap max-w-[1140px] mx-auto px-[40px] max-[900px]:px-[24px] py-12">
      <div className="flex justify-between items-baseline mb-6 border-b border-ink pb-4 max-[560px]:flex-col max-[560px]:items-start max-[560px]:gap-2">
        <h1 className="font-display text-[44px] font-normal tracking-[-0.015em] m-0 max-[560px]:text-[32px]">
          {title}
        </h1>
        <span className="text-[12px] tracking-[0.22em] uppercase text-muted font-body">
          {items.length} {items.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      <p className="font-display italic text-[18px] text-ink-soft mb-10 max-w-[640px]">
        {description}
      </p>
      {items.length === 0 ? (
        <p className="text-muted italic font-display">Nothing here yet.</p>
      ) : (
        <ul className="list-none p-0 m-0">
          {items.map((item) => (
            <li key={item.slug} className="py-5 border-b border-rule-soft">
              <Link
                href={`/${path}/${item.slug}`}
                className="plain font-display text-[22px] hover:text-accent"
              >
                {item.canonical_name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
