"use client";

import { useState } from "react";

import {
  VoiceInterviewWidget,
  type VoiceSessionPayload,
} from "./VoiceInterviewWidget";

type State = "idle" | "starting" | "active" | "error";

export function VoiceInterviewForm() {
  const [expertise, setExpertise] = useState("");
  const [state, setState] = useState<State>("idle");
  const [session, setSession] = useState<VoiceSessionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setState("starting");
    setError(null);
    try {
      const res = await fetch("/api/voice-interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "general",
          expertise_text: expertise.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Failed: ${res.status}`);
      }
      const payload = (await res.json()) as VoiceSessionPayload;
      setSession(payload);
      setState("active");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start");
      setState("error");
    }
  }

  if (state === "active" && session) {
    return <VoiceInterviewWidget session={session} />;
  }

  return (
    <div>
      <p className="font-display italic text-[17px] text-ink-soft mb-6 max-w-[640px]">
        Optional — tell us a few words about your specialty so we can tailor
        the questions. Leave blank, type a few words, or paste a chunk of text.
      </p>
      <textarea
        value={expertise}
        onChange={(e) => setExpertise(e.target.value)}
        rows={5}
        placeholder="e.g., school psychologist in NYC public schools, primarily K-8 evaluation work…"
        disabled={state === "starting"}
        className="w-full max-w-[760px] border border-rule bg-bg-elev p-4 font-body text-[16px] text-ink leading-[1.55] outline-none focus:border-accent block"
      />
      {state === "error" && error ? (
        <p className="mt-3 text-[14px] text-accent font-body">{error}</p>
      ) : null}
      <div className="mt-6">
        <button
          type="button"
          onClick={start}
          disabled={state === "starting"}
          className="font-body text-[13px] tracking-[0.16em] uppercase px-[22px] py-[14px] bg-ink text-bg-elev border border-ink hover:bg-accent hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state === "starting" ? "Connecting…" : "Start interview"}
        </button>
        <p className="mt-3 text-[12px] tracking-[0.14em] uppercase text-muted font-body">
          Your browser will ask for microphone access.
        </p>
      </div>
    </div>
  );
}
