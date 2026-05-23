"use client";

import { useEffect, useState } from "react";

interface Props {
  sessionId: string;
}

interface StatusPayload {
  status: string;
  contribution_id: string | null;
  last_error: string | null;
}

export function VoiceInterviewStatus({ sessionId }: Props) {
  const [status, setStatus] = useState<string>("transcript_pending");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      try {
        const res = await fetch(`/api/voice-interview/status/${sessionId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Status fetch failed: ${res.status}`);
        const data = (await res.json()) as StatusPayload;
        if (cancelled) return;
        setStatus(data.status);
        if (data.last_error) setError(data.last_error);
        if (data.status === "completed" && data.contribution_id) {
          window.location.href = `/thank-you?contribution_id=${data.contribution_id}`;
        }
        if (
          data.status === "completed" ||
          data.status === "failed" ||
          data.status === "abandoned"
        ) {
          if (interval) clearInterval(interval);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    void poll();
    interval = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [sessionId]);

  if (status === "failed" || status === "abandoned") {
    return (
      <div>
        <h1 className="font-display text-[44px] font-normal tracking-[-0.015em] m-0 mb-4 max-[560px]:text-[32px]">
          We couldn&rsquo;t retrieve your interview transcript.
        </h1>
        <p className="font-display italic text-[18px] text-ink-soft mb-8 max-w-[640px]">
          The recording may not have been processed in time. If you remember
          the gist of what you talked about, please paste it on the contribute
          page and we&rsquo;ll fold it in.
        </p>
        <a
          href="/contribute"
          className="plain inline-block font-body text-[13px] tracking-[0.16em] uppercase px-[22px] py-[14px] bg-ink text-bg-elev border border-ink hover:bg-accent hover:border-accent"
        >
          Paste a transcript
        </a>
        {error ? (
          <p className="mt-6 text-[12px] text-muted font-body">
            Detail: {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-[44px] font-normal tracking-[-0.015em] m-0 mb-4 max-[560px]:text-[32px]">
        Processing your interview…
      </h1>
      <p className="font-display italic text-[18px] text-ink-soft mb-8 max-w-[640px]">
        ElevenLabs is still preparing the transcript. This page refreshes
        automatically when it&rsquo;s ready — usually a few minutes. You can
        also bookmark this URL and come back later.
      </p>
      <p className="text-[12px] tracking-[0.14em] uppercase text-muted font-body">
        Polling every 30 seconds…
      </p>
    </div>
  );
}
