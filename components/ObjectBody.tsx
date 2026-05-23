import { parseObjectBody } from "@/lib/parsing";

import { ConfidenceLabel } from "./ConfidenceLabel";

interface Props {
  body: string;
}

export function ObjectBody({ body }: Props) {
  if (!body || body.trim().length === 0) {
    return (
      <p className="font-display italic text-[18px] text-muted m-0">
        No contributions yet — this page will fill in as practitioners write
        about it.
      </p>
    );
  }
  const parsed = parseObjectBody(body);
  return (
    <article className="font-display text-[19px] leading-[1.6] text-ink whitespace-pre-wrap max-w-[680px] max-[900px]:text-[17px]">
      {parsed.text_chunks.map((chunk, i) => (
        <span key={i}>
          {chunk.text}
          {chunk.label ? <ConfidenceLabel level={chunk.label} /> : null}
        </span>
      ))}
    </article>
  );
}
