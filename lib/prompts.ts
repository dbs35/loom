import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

import { getSupabase } from "./supabase";

export type PromptName =
  | "extraction"
  | "synthesis"
  | "chat-bar"
  | "interviewer-general"
  | "interviewer-per-page";

const bundledCache = new Map<PromptName, string>();

async function readBundledPrompt(name: PromptName): Promise<string> {
  const cached = bundledCache.get(name);
  if (cached !== undefined) return cached;
  const filePath = path.join(process.cwd(), "prompts", `${name}.md`);
  const content = await fs.readFile(filePath, "utf-8");
  bundledCache.set(name, content);
  return content;
}

export async function loadPrompt(name: PromptName): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("prompt_overrides")
    .select("override_text")
    .eq("name", name)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }
  if (data?.override_text) return data.override_text;

  return readBundledPrompt(name);
}

export function substitute(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    return key in variables ? variables[key] : match;
  });
}
