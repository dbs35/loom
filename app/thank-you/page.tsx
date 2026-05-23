import { notFound } from "next/navigation";

import { getSupabase } from "@/lib/supabase";
import { ThankYou } from "@/components/ThankYou";
import type { ObjectType } from "@/lib/parsing";

export const dynamic = "force-dynamic";

interface MentionWithObject {
  text_fragment: string;
  created_at: string;
  object: {
    id: string;
    type: ObjectType;
    slug: string;
    canonical_name: string;
  } | null;
}

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ contribution_id?: string | string[] }>;
}) {
  const params = await searchParams;
  const idRaw = params.contribution_id;
  const id = Array.isArray(idRaw) ? idRaw[0] : idRaw;
  if (!id) notFound();

  const supabase = getSupabase();

  const { data: contrib } = await supabase
    .from("contributions")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!contrib) notFound();

  const { data: mentions } = await supabase
    .from("mentions")
    .select(
      "text_fragment, created_at, object:objects(id, type, slug, canonical_name)",
    )
    .eq("contribution_id", id)
    .order("created_at", { ascending: true });

  const rows = (mentions ?? []) as unknown as MentionWithObject[];
  const affected = rows
    .filter((r) => r.object !== null)
    .map((r) => ({
      object: r.object!,
      text_fragment: r.text_fragment,
    }));

  return (
    <ThankYou
      affected={affected}
      feedbackEmail={process.env.FEEDBACK_EMAIL ?? null}
    />
  );
}
