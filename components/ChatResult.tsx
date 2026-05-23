import { parseChatResult } from "@/lib/parsing";
import type { CitedObject } from "@/lib/chatbar";

import { Citation } from "./Citation";

interface Props {
  answer: string;
  citedObjects: CitedObject[];
}

export function ChatResult({ answer, citedObjects }: Props) {
  const parsed = parseChatResult(answer);
  const lookup = new Map<string, CitedObject>(
    citedObjects.map((o) => [`${o.type}/${o.slug}`, o]),
  );

  const refNumbers = new Map<string, number>();
  let n = 1;
  for (const chunk of parsed.text_chunks) {
    if (!chunk.ref) continue;
    const key = `${chunk.ref.type}/${chunk.ref.slug}`;
    if (!refNumbers.has(key)) {
      refNumbers.set(key, n);
      n += 1;
    }
  }

  return (
    <article className="font-display text-[20px] leading-[1.55] text-ink whitespace-pre-wrap max-[900px]:text-[18px]">
      {parsed.text_chunks.map((chunk, i) => {
        if (!chunk.ref) {
          return <span key={i}>{chunk.text}</span>;
        }
        const key = `${chunk.ref.type}/${chunk.ref.slug}`;
        const obj = lookup.get(key);
        const num = refNumbers.get(key) ?? 0;
        return (
          <span key={i}>
            {chunk.text}
            <Citation
              type={chunk.ref.type}
              slug={chunk.ref.slug}
              number={num}
              canonicalName={obj?.canonical_name}
            />
          </span>
        );
      })}
    </article>
  );
}
