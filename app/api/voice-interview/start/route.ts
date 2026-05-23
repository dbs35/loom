import { NextResponse, type NextRequest } from "next/server";

import { getSupabase } from "@/lib/supabase";
import { getSignedUrl } from "@/lib/elevenlabs";
import { loadPrompt, substitute } from "@/lib/prompts";
import { getObjectByTypeAndSlug } from "@/lib/content";
import type { ObjectType } from "@/lib/parsing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES: ObjectType[] = ["program", "paper", "question", "specialist"];

const GENERAL_FIRST_MESSAGE =
  "Thanks for doing this. To get us going — what are the three or four questions you get asked most often by families or referrers?";

export async function POST(req: NextRequest) {
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

  // Abandon flow: { session_id, status: "abandoned" }
  if (b.status === "abandoned" && typeof b.session_id === "string") {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("voice_sessions")
      .update({
        status: "abandoned",
        updated_at: new Date().toISOString(),
      })
      .eq("id", b.session_id)
      .eq("status", "in_progress");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // Start flow: { kind: "general" | "per-page", expertise_text?, page_context_* }
  const kind = b.kind;
  if (kind !== "general" && kind !== "per-page") {
    return NextResponse.json(
      { error: "kind must be 'general' or 'per-page'" },
      { status: 400 },
    );
  }

  let agentId: string;
  let systemPrompt: string;
  let firstMessage: string;
  let pageContextType: ObjectType | null = null;
  let pageContextSlug: string | null = null;
  let contributorExpertise: string | null = null;

  if (kind === "general") {
    agentId = process.env.ELEVENLABS_AGENT_GENERAL ?? "";
    if (!agentId) {
      return NextResponse.json(
        { error: "ELEVENLABS_AGENT_GENERAL not configured" },
        { status: 503 },
      );
    }
    const text =
      typeof b.expertise_text === "string" ? b.expertise_text.trim() : "";
    contributorExpertise = text.length > 0 ? text : null;
    const template = await loadPrompt("interviewer-general");
    systemPrompt = substitute(template, {
      contributor_expertise:
        contributorExpertise ?? "(no expertise context provided)",
    });
    firstMessage = GENERAL_FIRST_MESSAGE;
  } else {
    agentId = process.env.ELEVENLABS_AGENT_PER_PAGE ?? "";
    if (!agentId) {
      return NextResponse.json(
        { error: "ELEVENLABS_AGENT_PER_PAGE not configured" },
        { status: 503 },
      );
    }
    if (
      typeof b.page_context_type !== "string" ||
      !VALID_TYPES.includes(b.page_context_type as ObjectType) ||
      typeof b.page_context_slug !== "string" ||
      b.page_context_slug.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "per-page kind requires valid page_context_type and page_context_slug",
        },
        { status: 400 },
      );
    }
    pageContextType = b.page_context_type as ObjectType;
    pageContextSlug = b.page_context_slug;
    const obj = await getObjectByTypeAndSlug(pageContextType, pageContextSlug);
    if (!obj) {
      return NextResponse.json({ error: "object not found" }, { status: 404 });
    }
    const objectContext = [
      `Canonical name: ${obj.canonical_name}`,
      `Type: ${obj.type}`,
      `Frontmatter:`,
      JSON.stringify(obj.frontmatter ?? {}, null, 2),
      `Current body:`,
      obj.body && obj.body.trim().length > 0
        ? obj.body
        : "(empty — no contributions yet)",
    ].join("\n");
    const template = await loadPrompt("interviewer-per-page");
    systemPrompt = substitute(template, { object_context: objectContext });
    firstMessage = `Thanks for adding to this. I see you're contributing on the page for ${obj.canonical_name}. To start — what's the one thing you want a future reader of this page to know that isn't already there?`;
  }

  let signedUrl: string;
  try {
    signedUrl = await getSignedUrl(agentId);
  } catch (err) {
    console.error("[voice/start] signed URL failed", err);
    return NextResponse.json(
      { error: "Voice service temporarily unavailable" },
      { status: 503 },
    );
  }

  const supabase = getSupabase();
  const { data: inserted, error: insertErr } = await supabase
    .from("voice_sessions")
    .insert({
      agent_id: agentId,
      page_context_type: pageContextType,
      page_context_slug: pageContextSlug,
      contributor_expertise: contributorExpertise,
      system_prompt: systemPrompt,
      first_message: firstMessage,
      status: "in_progress",
    })
    .select("id")
    .single();
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }
  const sessionId = (inserted as { id: string }).id;

  return NextResponse.json({
    session_id: sessionId,
    signed_url: signedUrl,
    system_prompt: systemPrompt,
    first_message: firstMessage,
    agent_id: agentId,
  });
}
