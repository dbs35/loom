import { promises as fs } from "node:fs";
import path from "node:path";

import { getSupabase } from "@/lib/supabase";
import type { PromptName } from "@/lib/prompts";
import { AdminPromptEditor } from "@/components/AdminPromptEditor";

export const dynamic = "force-dynamic";

const PROMPT_NAMES: PromptName[] = [
  "extraction",
  "synthesis",
  "chat-bar",
  "interviewer-general",
  "interviewer-per-page",
];

interface OverrideRow {
  name: string;
  override_text: string;
  updated_at: string;
}

async function readBundled(name: PromptName): Promise<string> {
  return fs.readFile(
    path.join(process.cwd(), "prompts", `${name}.md`),
    "utf-8",
  );
}

export default async function AdminPromptsPage() {
  const supabase = getSupabase();
  const { data: overridesRaw, error } = await supabase
    .from("prompt_overrides")
    .select("name, override_text, updated_at");
  if (error) throw error;
  const overrideMap = new Map<string, OverrideRow>();
  for (const row of (overridesRaw ?? []) as OverrideRow[]) {
    overrideMap.set(row.name, row);
  }

  const sections = await Promise.all(
    PROMPT_NAMES.map(async (name) => ({
      name,
      bundled: await readBundled(name),
      override: overrideMap.get(name) ?? null,
    })),
  );

  return (
    <div>
      <div className="text-[11px] tracking-[0.22em] uppercase text-muted font-body mb-3">
        Prompts
      </div>
      <h1 className="font-display text-[36px] font-normal tracking-[-0.015em] m-0 mb-2">
        Prompt library
      </h1>
      <p className="text-[14px] text-muted font-body mb-8 max-w-[720px]">
        Each section shows the effective text used at runtime. Saving an
        override writes to <code className="font-mono text-[12px]">prompt_overrides</code>;{" "}
        reverting deletes the override row so the bundled default is used
        again.
      </p>
      {sections.map((s) => (
        <AdminPromptEditor
          key={s.name}
          name={s.name}
          bundled={s.bundled}
          overrideText={s.override?.override_text ?? null}
          overrideUpdatedAt={s.override?.updated_at ?? null}
        />
      ))}
    </div>
  );
}
