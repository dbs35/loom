export type ConfidenceLevel = "well-supported" | "single-source" | "contested";

export type ObjectType = "program" | "paper" | "question" | "specialist";

export interface ObjectBodyChunk {
  text: string;
  label?: ConfidenceLevel;
}

export interface ParsedObjectBody {
  text_chunks: ObjectBodyChunk[];
}

export interface ChatResultRef {
  type: ObjectType;
  slug: string;
}

export interface ChatResultChunk {
  text: string;
  ref?: ChatResultRef;
}

export interface ParsedChatResult {
  text_chunks: ChatResultChunk[];
}

const CONFIDENCE_RE = /\[(well-supported|single-source|contested)\]/g;
const REF_RE = /\[ref:\s*(program|paper|question|specialist)\/([a-z0-9-]+)\]/gi;

export function parseObjectBody(body: string): ParsedObjectBody {
  const chunks: ObjectBodyChunk[] = [];
  let lastIndex = 0;
  const re = new RegExp(CONFIDENCE_RE.source, CONFIDENCE_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const text = body.slice(lastIndex, match.index);
    chunks.push({ text, label: match[1] as ConfidenceLevel });
    lastIndex = match.index + match[0].length;
  }
  const trailing = body.slice(lastIndex);
  if (trailing.length > 0) chunks.push({ text: trailing });
  return { text_chunks: chunks };
}

export function parseChatResult(answer: string): ParsedChatResult {
  const chunks: ChatResultChunk[] = [];
  let lastIndex = 0;
  const re = new RegExp(REF_RE.source, REF_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(answer)) !== null) {
    const text = answer.slice(lastIndex, match.index);
    const type = match[1].toLowerCase() as ObjectType;
    const slug = match[2].toLowerCase();
    chunks.push({ text, ref: { type, slug } });
    lastIndex = match.index + match[0].length;
  }
  const trailing = answer.slice(lastIndex);
  if (trailing.length > 0) chunks.push({ text: trailing });
  return { text_chunks: chunks };
}

export function extractCitedRefs(answer: string): ChatResultRef[] {
  const seen = new Set<string>();
  const refs: ChatResultRef[] = [];
  const re = new RegExp(REF_RE.source, REF_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(answer)) !== null) {
    const type = match[1].toLowerCase() as ObjectType;
    const slug = match[2].toLowerCase();
    const key = `${type}/${slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ type, slug });
  }
  return refs;
}
