import "server-only";

const API_BASE = "https://api.elevenlabs.io";

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");
  return key;
}

export async function getSignedUrl(agentId: string): Promise<string> {
  const res = await fetch(
    `${API_BASE}/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    { headers: { "xi-api-key": getApiKey() } },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`getSignedUrl failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { signed_url: string };
  return data.signed_url;
}

export interface TranscriptTurn {
  role: "user" | "agent";
  message: string | null;
  time_in_call_secs?: number;
}

export interface ConversationData {
  status: "in-progress" | "processing" | "done" | "failed";
  transcript?: TranscriptTurn[];
}

export async function getConversation(
  conversationId: string,
): Promise<ConversationData> {
  const res = await fetch(
    `${API_BASE}/v1/convai/conversations/${encodeURIComponent(conversationId)}`,
    { headers: { "xi-api-key": getApiKey() } },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`getConversation failed: ${res.status} ${text}`);
  }
  return (await res.json()) as ConversationData;
}

export interface ProvisionAgentOpts {
  name: string;
  defaultPrompt: string;
  defaultFirstMessage?: string;
  existingId?: string;
}

function agentBody(opts: ProvisionAgentOpts) {
  return {
    name: opts.name,
    conversation_config: {
      agent: {
        prompt: { prompt: opts.defaultPrompt },
        first_message:
          opts.defaultFirstMessage ?? "Hi — what brings you here today?",
        language: "en",
      },
    },
    platform_settings: {
      overrides: {
        conversation_config_override: {
          agent: {
            prompt: { prompt: true },
            first_message: true,
          },
        },
      },
    },
  };
}

export async function provisionAgent(
  opts: ProvisionAgentOpts,
): Promise<{ id: string }> {
  const body = agentBody(opts);
  const headers = {
    "xi-api-key": getApiKey(),
    "Content-Type": "application/json",
  };
  if (opts.existingId) {
    const res = await fetch(
      `${API_BASE}/v1/convai/agents/${encodeURIComponent(opts.existingId)}`,
      { method: "PATCH", headers, body: JSON.stringify(body) },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`provisionAgent PATCH failed: ${res.status} ${text}`);
    }
    return { id: opts.existingId };
  }
  const res = await fetch(`${API_BASE}/v1/convai/agents/create`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`provisionAgent CREATE failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { agent_id: string };
  return { id: data.agent_id };
}

export function flattenTranscript(turns: TranscriptTurn[]): string {
  return turns
    .filter((t) => t.message !== null && t.message.trim().length > 0)
    .map((t) => {
      const label = t.role === "agent" ? "Interviewer" : "Contributor";
      return `[${label}] ${t.message!.trim()}`;
    })
    .join("\n");
}
