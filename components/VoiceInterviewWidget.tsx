"use client";

import { useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";

export interface VoiceSessionPayload {
  session_id: string;
  signed_url: string;
  system_prompt: string;
  first_message: string;
  agent_id: string;
}

interface Props {
  session: VoiceSessionPayload;
}

export function VoiceInterviewWidget({ session }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const finishingRef = useRef(false);

  const conversation = useConversation({
    onConnect: () => {
      startedAtRef.current = Date.now();
    },
    onDisconnect: () => {
      if (finishingRef.current) return;
      void completeSession();
    },
    onError: (err) => {
      setError(typeof err === "string" ? err : JSON.stringify(err));
    },
  });

  // Start the session on mount
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await conversation.startSession({
          signedUrl: session.signed_url,
          overrides: {
            agent: {
              prompt: { prompt: session.system_prompt },
              firstMessage: session.first_message,
            },
          },
        });
        // Capture conversation id once the session starts
        const id = conversation.getId();
        if (id) {
          conversationIdRef.current = id;
          try {
            sessionStorage.setItem(
              `pc_voice_${session.session_id}`,
              id,
            );
          } catch {
            /* sessionStorage may be unavailable */
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Elapsed-time counter
  useEffect(() => {
    const interval = setInterval(() => {
      if (startedAtRef.current) {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // beforeunload backstop: try to mark completion via sendBeacon
  useEffect(() => {
    function handleBeforeUnload() {
      const convId = conversationIdRef.current;
      if (!convId) return;
      const payload = JSON.stringify({
        session_id: session.session_id,
        conversation_id: convId,
      });
      try {
        navigator.sendBeacon(
          "/api/voice-interview/complete",
          new Blob([payload], { type: "application/json" }),
        );
      } catch {
        /* sendBeacon may be unavailable */
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [session.session_id]);

  async function completeSession() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    const convId = conversationIdRef.current;
    if (!convId) {
      setError(
        "Conversation never connected — please reload the page and try again.",
      );
      finishingRef.current = false;
      setFinishing(false);
      return;
    }
    try {
      const res = await fetch("/api/voice-interview/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.session_id,
          conversation_id: convId,
        }),
      });
      const data = (await res.json()) as {
        status?: string;
        contribution_id?: string;
        session_id?: string;
      };
      if (data.status === "completed" && data.contribution_id) {
        window.location.href = `/thank-you?contribution_id=${data.contribution_id}`;
      } else if (data.status === "transcript_pending" && data.session_id) {
        window.location.href = `/voice-interview/status/${data.session_id}`;
      } else if (data.status === "already_processed") {
        // Another completion call already won; just poll status
        window.location.href = `/voice-interview/status/${session.session_id}`;
      } else {
        setError("Could not complete interview.");
        finishingRef.current = false;
        setFinishing(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      finishingRef.current = false;
      setFinishing(false);
    }
  }

  async function endInterview() {
    try {
      await conversation.endSession();
    } catch (err) {
      console.error(err);
    }
    // onDisconnect → completeSession
  }

  async function cancelInterview() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    try {
      await conversation.endSession();
    } catch {
      /* ignore */
    }
    try {
      await fetch("/api/voice-interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.session_id,
          status: "abandoned",
        }),
      });
    } catch {
      /* best effort */
    }
    window.location.href = "/";
  }

  const status = conversation.status;
  const isSpeaking = conversation.isSpeaking;

  const statusLabel =
    status === "connecting"
      ? "Connecting…"
      : status === "connected"
        ? isSpeaking
          ? "Interviewer speaking"
          : "Listening to you"
        : status === "disconnecting"
          ? "Wrapping up…"
          : status === "disconnected"
            ? "Disconnected"
            : String(status);

  const minutes = Math.floor(elapsed / 60).toString();
  const seconds = (elapsed % 60).toString().padStart(2, "0");

  return (
    <div className="max-w-[640px]">
      <div className="bg-bg-elev border border-rule p-8 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <span
            className={`inline-block w-[10px] h-[10px] rounded-full ${
              status === "connected" ? "bg-accent" : "bg-muted"
            } ${isSpeaking ? "animate-pulse" : ""}`}
            aria-hidden="true"
          />
          <span className="text-[11px] tracking-[0.22em] uppercase text-muted font-body">
            {statusLabel}
          </span>
          {startedAtRef.current ? (
            <span className="ml-auto font-body text-[14px] text-ink-soft tabular-nums">
              {minutes}:{seconds}
            </span>
          ) : null}
        </div>
        <p className="font-display italic text-[17px] text-ink-soft m-0">
          {status === "connected"
            ? "Have a real conversation. End the call when you're done."
            : "Setting up the conversation…"}
        </p>
      </div>

      {error ? (
        <p className="text-[14px] text-accent font-body mb-4">{error}</p>
      ) : null}

      <div className="flex gap-4 items-center flex-wrap">
        <button
          type="button"
          onClick={endInterview}
          disabled={status !== "connected" || finishing}
          className="font-body text-[13px] tracking-[0.16em] uppercase px-[22px] py-[14px] bg-ink text-bg-elev border border-ink hover:bg-accent hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {finishing ? "Saving…" : "End interview"}
        </button>
        <button
          type="button"
          onClick={cancelInterview}
          disabled={finishing}
          className="font-body text-[12px] tracking-[0.14em] uppercase text-muted hover:text-ink underline-offset-4 hover:underline disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
