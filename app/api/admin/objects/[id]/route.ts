import { NextResponse, type NextRequest } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { deleteObject, updateObjectMeta } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(): Promise<NextResponse | null> {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "body must be an object" },
      { status: 400 },
    );
  }
  const b = body as Record<string, unknown>;

  const patch: Parameters<typeof updateObjectMeta>[1] = {};
  if (typeof b.canonical_name === "string") {
    const trimmed = b.canonical_name.trim();
    if (trimmed.length === 0) {
      return NextResponse.json(
        { error: "canonical_name cannot be empty" },
        { status: 400 },
      );
    }
    patch.canonical_name = trimmed;
  }
  if (Array.isArray(b.aliases)) {
    patch.aliases = b.aliases.filter((a): a is string => typeof a === "string");
  }
  if (typeof b.frontmatter === "object" && b.frontmatter !== null) {
    patch.frontmatter = b.frontmatter as Record<string, unknown>;
  }

  try {
    await updateObjectMeta(id, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  try {
    await deleteObject(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 },
    );
  }
}
