import { NextResponse, type NextRequest } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { mergeObjects } from "@/lib/admin";
import { getSupabase } from "@/lib/supabase";
import type { ObjectType } from "@/lib/parsing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: sourceId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { target_id?: unknown }).target_id !== "string"
  ) {
    return NextResponse.json({ error: "target_id required" }, { status: 400 });
  }
  const targetId = (body as { target_id: string }).target_id;

  try {
    await mergeObjects(sourceId, targetId);
    const supabase = getSupabase();
    const { data: targetRaw, error } = await supabase
      .from("objects")
      .select("type, slug, canonical_name")
      .eq("id", targetId)
      .single();
    if (error) throw error;
    const target = targetRaw as {
      type: ObjectType;
      slug: string;
      canonical_name: string;
    };
    return NextResponse.json({ ok: true, target });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Merge failed" },
      { status: 500 },
    );
  }
}
