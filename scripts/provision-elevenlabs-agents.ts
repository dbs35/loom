try {
  process.loadEnvFile();
} catch {
  // .env may already be loaded via --env-file-if-exists, or absent
}

import { loadPrompt, substitute } from "../lib/prompts";
import { provisionAgent } from "../lib/elevenlabs";

const GENERAL_FIRST_MESSAGE =
  "Thanks for doing this. To get us going — what are the three or four questions you get asked most often by families or referrers?";

const PER_PAGE_FIRST_MESSAGE = "Hi — what brings you to this page?";

async function provisionGeneral() {
  const template = await loadPrompt("interviewer-general");
  const rendered = substitute(template, {
    contributor_expertise: "(no expertise context provided)",
  });
  const existingId = process.env.ELEVENLABS_AGENT_GENERAL;
  const result = await provisionAgent({
    name: "Practice Commons — General Interviewer",
    defaultPrompt: rendered,
    defaultFirstMessage: GENERAL_FIRST_MESSAGE,
    existingId: existingId || undefined,
  });
  const action = existingId ? "patched existing" : "created new";
  console.log(`  general  (${action}): ${result.id}`);
  if (!existingId) {
    console.log(`    -> set ELEVENLABS_AGENT_GENERAL=${result.id} in your env`);
  }
}

async function provisionPerPage() {
  const template = await loadPrompt("interviewer-per-page");
  const rendered = substitute(template, {
    object_context:
      "(no object context — this is the default prompt; production calls always override with per-session context)",
  });
  const existingId = process.env.ELEVENLABS_AGENT_PER_PAGE;
  const result = await provisionAgent({
    name: "Practice Commons — Per-Page Interviewer",
    defaultPrompt: rendered,
    defaultFirstMessage: PER_PAGE_FIRST_MESSAGE,
    existingId: existingId || undefined,
  });
  const action = existingId ? "patched existing" : "created new";
  console.log(`  per-page (${action}): ${result.id}`);
  if (!existingId) {
    console.log(`    -> set ELEVENLABS_AGENT_PER_PAGE=${result.id} in your env`);
  }
}

async function main() {
  console.log("Provisioning ElevenLabs agents...");
  await provisionGeneral();
  await provisionPerPage();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Provisioning failed:", err);
  process.exit(1);
});
