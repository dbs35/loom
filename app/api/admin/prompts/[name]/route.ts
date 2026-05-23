import { NextResponse, type NextRequest } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getSupabase } from "@/lib/supabase";
import type { PromptName } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_NAMES: PromptName[] = [
  "extraction",
  "synthesis",
  "chat-bar",
  "interviewer-general",
  "interviewer-per-page",
];

function isPromptName(value: string): value is PromptName {
  return (VALID_NAMES as string[]).includes(value);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { name } = await params;
  if (!isPromptName(name)) {
    return NextResponse.json({ error: "unknown prompt name" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { override_text?: unknown }).override_text !== "string"
  ) {
    return NextResponse.json(
      { error: "override_text (string) required" },
      { status: 400 },
    );
  }
  const overrideText = (body as { override_text: string }).override_text;

  const supabase = getSupabase();
  const { error } = await supabase
    .from("prompt_overrides")
    .upsert(
      {
        name,
        override_text: overrideText,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "name" },
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { name } = await params;
  if (!isPromptName(name)) {
    return NextResponse.json({ error: "unknown prompt name" }, { status: 400 });
  }
  const supabase = getSupabase();
  const { error } = await supabase
    .from("prompt_overrides")
    .delete()
    .eq("name", name);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
