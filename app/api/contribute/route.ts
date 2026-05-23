import { NextResponse, type NextRequest } from "next/server";

import { runExtraction, type ContributionSource } from "@/lib/extraction";
import type { ObjectType } from "@/lib/parsing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_SOURCES: ContributionSource[] = ["per_page", "general"];
const VALID_TYPES: ObjectType[] = ["program", "paper", "question", "specialist"];

function isString(value: unknown): value is string {
  return typeof value === "string";
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "body must be an object" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  if (!isString(b.raw_input) || b.raw_input.trim().length === 0) {
    return NextResponse.json(
      { error: "raw_input is required and must be a non-empty string" },
      { status: 400 },
    );
  }
  if (!isString(b.source) || !VALID_SOURCES.includes(b.source as ContributionSource)) {
    return NextResponse.json(
      { error: `source must be one of: ${VALID_SOURCES.join(", ")}` },
      { status: 400 },
    );
  }

  let page_context_type: ObjectType | null = null;
  let page_context_slug: string | null = null;
  if (b.page_context_type != null || b.page_context_slug != null) {
    if (
      !isString(b.page_context_type) ||
      !VALID_TYPES.includes(b.page_context_type as ObjectType)
    ) {
      return NextResponse.json(
        { error: "page_context_type must be a valid object type" },
        { status: 400 },
      );
    }
    if (!isString(b.page_context_slug) || b.page_context_slug.length === 0) {
      return NextResponse.json(
        { error: "page_context_slug must accompany page_context_type" },
        { status: 400 },
      );
    }
    page_context_type = b.page_context_type as ObjectType;
    page_context_slug = b.page_context_slug;
  }

  const result = await runExtraction({
    raw_input: b.raw_input.trim(),
    source: b.source as ContributionSource,
    page_context_type,
    page_context_slug,
  });

  return NextResponse.json(result);
}
