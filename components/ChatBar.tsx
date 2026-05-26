"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

interface Props {
  initialQuery?: string;
  compact?: boolean;
}

export function ChatBar({ initialQuery, compact }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery ?? "");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isPending) return;
    startTransition(() => {
      router.push(`/q?query=${encodeURIComponent(trimmed)}`);
    });
  };

  return (
    <form
      action="/q"
      method="get"
      onSubmit={handleSubmit}
      className={
        compact
          ? "mx-auto max-w-[760px]"
          : "mx-auto max-w-[760px] mt-0"
      }
    >
      <div
        className="ask-bar bg-bg-elev border border-rule rounded-[2px] px-[28px] py-[22px] flex items-center gap-[18px] shadow-[0_1px_0_var(--rule-soft)] max-[900px]:flex-col max-[900px]:items-stretch"
        aria-busy={isPending}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-muted flex-shrink-0"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          name="query"
          type="text"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isPending}
          placeholder="What are you looking for?"
          aria-label="Ask the commons"
          className="flex-1 border-0 bg-transparent outline-none font-display italic font-light text-[22px] text-ink placeholder:text-muted placeholder:opacity-90 disabled:opacity-60 max-[900px]:text-[18px]"
        />
        <button
          type="submit"
          disabled={isPending}
          className="bg-ink text-bg-elev border-0 px-[18px] py-[10px] cursor-pointer font-body text-[13px] tracking-[0.14em] uppercase hover:bg-accent disabled:cursor-wait disabled:opacity-70 disabled:hover:bg-ink"
        >
          {isPending ? "Working…" : "Ask"}
        </button>
      </div>
      {isPending ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 text-center font-body text-[13px] italic text-muted"
        >
          Preparing your answer — this may take a few seconds.
        </p>
      ) : null}
    </form>
  );
}
