try {
  process.loadEnvFile();
} catch {
  // .env may already be loaded via --env-file, or absent; not fatal
}

import { runSeed } from "../lib/seed";

async function main() {
  const result = await runSeed({ onLog: (msg) => console.log(msg) });
  const extracted = result.interviews.filter((i) => i.status === "extracted")
    .length;
  const skipped = result.interviews.filter((i) => i.status === "skipped").length;
  console.log(`\n  interviews: ${extracted} extracted, ${skipped} already-seeded`);
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
