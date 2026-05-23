import { NextResponse, type NextRequest } from "next/server";

import { runChatBar } from "@/lib/chatbar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  if (typeof b.query_text !== "string" || b.query_text.trim().length === 0) {
    return NextResponse.json(
      { error: "query_text is required and must be a non-empty string" },
      { status: 400 },
    );
  }

  const result = await runChatBar(b.query_text.trim());
  return NextResponse.json(result);
}
