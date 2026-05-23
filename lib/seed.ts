import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { getSupabase } from "./supabase";
import { runExtraction } from "./extraction";
import type { ObjectType } from "./parsing";

interface ScaffoldFile {
  canonical_name: string;
  aliases: string[];
  frontmatter: Record<string, unknown>;
}

const TYPE_DIRS: Record<ObjectType, string> = {
  program: "programs",
  paper: "papers",
  question: "questions",
  specialist: "specialists",
};

export interface ScaffoldTypeResult {
  type: ObjectType;
  created: number;
  updated: number;
  total: number;
}

export interface InterviewResult {
  name: string;
  status: "skipped" | "extracted";
  mentions?: number;
  malformed?: boolean;
}

export interface SeedResult {
  scaffolds: ScaffoldTypeResult[];
  interviews: InterviewResult[];
}

async function loadScaffolds(
  type: ObjectType,
): Promise<Array<{ slug: string; data: ScaffoldFile }>> {
  const dir = path.join(
    process.cwd(),
    "seeds",
    "initial-objects",
    TYPE_DIRS[type],
  );
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: Array<{ slug: string; data: ScaffoldFile }> = [];
  for (const entry of entries.sort()) {
    if (!entry.endsWith(".json")) continue;
    const slug = entry.replace(/\.json$/, "");
    const raw = await fs.readFile(path.join(dir, entry), "utf-8");
    out.push({ slug, data: JSON.parse(raw) as ScaffoldFile });
  }
  return out;
}

async function upsertScaffold(
  type: ObjectType,
  slug: string,
  data: ScaffoldFile,
): Promise<"created" | "updated"> {
  const supabase = getSupabase();
  const { data: existing, error: lookupErr } = await supabase
    .from("objects")
    .select("id")
    .eq("type", type)
    .eq("slug", slug)
    .maybeSingle();
  if (lookupErr) throw lookupErr;

  if (existing) {
    const { error: updateErr } = await supabase
      .from("objects")
      .update({
        canonical_name: data.canonical_name,
        aliases: data.aliases,
        frontmatter: data.frontmatter,
      })
      .eq("id", (existing as { id: string }).id);
    if (updateErr) throw updateErr;
    return "updated";
  }

  const { error: insertErr } = await supabase.from("objects").insert({
    type,
    slug,
    canonical_name: data.canonical_name,
    aliases: data.aliases,
    frontmatter: data.frontmatter,
  });
  if (insertErr) throw insertErr;
  return "created";
}

async function loadInterviews(): Promise<Array<{ name: string; text: string }>> {
  const dir = path.join(process.cwd(), "seeds", "interviews");
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: Array<{ name: string; text: string }> = [];
  for (const entry of entries.sort()) {
    if (!entry.endsWith(".md")) continue;
    const text = (await fs.readFile(path.join(dir, entry), "utf-8")).trim();
    if (text.length === 0) continue;
    out.push({ name: entry, text });
  }
  return out;
}

async function seedInterview(text: string): Promise<{
  status: "skipped" | "extracted";
  mentions?: number;
  malformed?: boolean;
}> {
  const supabase = getSupabase();
  const { data: existing, error: lookupErr } = await supabase
    .from("contributions")
    .select("id")
    .eq("raw_input", text)
    .limit(1);
  if (lookupErr) throw lookupErr;
  if (existing && existing.length > 0) {
    return { status: "skipped" };
  }

  const result = await runExtraction({ raw_input: text, source: "general" });
  return {
    status: "extracted",
    mentions: result.affected_objects.length,
    malformed: result.malformed_response,
  };
}

export interface SeedOptions {
  onLog?: (message: string) => void;
}

export async function runSeed(opts: SeedOptions = {}): Promise<SeedResult> {
  const log = opts.onLog ?? (() => {});
  const types: ObjectType[] = ["program", "paper", "question", "specialist"];

  log("Seeding object scaffolds…");
  const scaffolds: ScaffoldTypeResult[] = [];
  for (const type of types) {
    const items = await loadScaffolds(type);
    let created = 0;
    let updated = 0;
    for (const { slug, data } of items) {
      const result = await upsertScaffold(type, slug, data);
      if (result === "created") created++;
      else updated++;
    }
    scaffolds.push({ type, created, updated, total: items.length });
    log(
      `  ${TYPE_DIRS[type].padEnd(12)} ${created} created, ${updated} updated (${items.length} total)`,
    );
  }

  log("Seeding interviews (each runs through extraction + synthesis)…");
  const interviews: InterviewResult[] = [];
  const interviewFiles = await loadInterviews();
  for (const { name, text } of interviewFiles) {
    const result = await seedInterview(text);
    if (result.status === "skipped") {
      log(`  ${name.padEnd(8)} skipped (already seeded)`);
      interviews.push({ name, status: "skipped" });
    } else {
      const marker = result.malformed ? "MALFORMED" : "ok";
      log(`  ${name.padEnd(8)} ${result.mentions} mentions extracted (${marker})`);
      interviews.push({
        name,
        status: "extracted",
        mentions: result.mentions,
        malformed: result.malformed,
      });
    }
  }

  return { scaffolds, interviews };
}
