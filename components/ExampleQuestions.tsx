"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type MouseEvent } from "react";

interface Props {
  examples: readonly string[];
}

export function ExampleQuestions({ examples }: Props) {
  const router = useRouter();
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClick = (
    e: MouseEvent<HTMLAnchorElement>,
    q: string,
  ) => {
    if (
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      e.button !== 0
    ) {
      return;
    }
    e.preventDefault();
    if (isPending) return;
    setPendingQuery(q);
    startTransition(() => {
      router.push(`/q?query=${encodeURIComponent(q)}`);
    });
  };

  const base =
    "font-body italic text-[14px] px-[14px] py-[7px] bg-tag-bg border rounded-full plain";

  return (
    <>
      <div
        className="max-w-[760px] mx-auto mt-[22px] flex flex-wrap gap-[10px] justify-center"
        aria-busy={isPending}
      >
        <span className="w-full text-center text-[11px] tracking-[0.2em] uppercase text-muted font-body mb-1">
          For example
        </span>
        {examples.map((q) => {
          const isThisPending = isPending && pendingQuery === q;
          const className = isPending
            ? isThisPending
              ? `${base} border-accent text-accent cursor-wait pointer-events-none`
              : `${base} border-rule text-ink-soft opacity-50 cursor-wait pointer-events-none`
            : `${base} border-rule text-ink-soft hover:bg-bg-elev hover:text-accent hover:border-accent-soft`;
          return (
            <a
              key={q}
              href={`/q?query=${encodeURIComponent(q)}`}
              onClick={(e) => handleClick(e, q)}
              aria-disabled={isPending}
              className={className}
            >
              {q}
            </a>
          );
        })}
      </div>
      {isPending ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-4 text-center font-body text-[13px] italic text-muted"
        >
          Preparing your answer — this may take a few seconds.
        </p>
      ) : null}
    </>
  );
}
