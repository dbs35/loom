import "server-only";
import Anthropic from "@anthropic-ai/sdk";

import { loadPrompt, substitute, type PromptName } from "./prompts";

export type { PromptName };

export interface CallLLMOptions {
  prompt_name: PromptName;
  variables: Record<string, string>;
  user_message: string;
  complexity?: number;
  max_tokens?: number;
  temperature?: number;
}

const DEFAULT_COMPLEXITY = 5;
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.3;
const MAX_RETRIES = 3;

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

function selectModel(complexity: number): string {
  if (complexity >= 9) {
    return process.env.OPUS_MODEL ?? "claude-opus-4-7";
  }
  return process.env.SONNET_MODEL ?? "claude-sonnet-4-6";
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    if (err.status === 429) return true;
    if (typeof err.status === "number" && err.status >= 500) return true;
  }
  if (err instanceof Anthropic.APIConnectionError) return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callLLM(opts: CallLLMOptions): Promise<string> {
  const complexity = opts.complexity ?? DEFAULT_COMPLEXITY;
  const model = selectModel(complexity);
  const max_tokens = opts.max_tokens ?? DEFAULT_MAX_TOKENS;
  const temperature = opts.temperature ?? DEFAULT_TEMPERATURE;

  const template = await loadPrompt(opts.prompt_name);
  const system = substitute(template, opts.variables);

  const client = getClient();

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens,
        temperature,
        system,
        messages: [{ role: "user", content: opts.user_message }],
      });

      return response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_RETRIES || !isRetryable(err)) throw err;
      const delay = 500 * 2 ** attempt;
      await sleep(delay);
    }
  }

  throw lastErr;
}
