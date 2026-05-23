import { NextResponse, type NextRequest } from "next/server";

import { clearAdminCookie } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await clearAdminCookie();
  return NextResponse.redirect(new URL("/admin", req.url), { status: 303 });
}
