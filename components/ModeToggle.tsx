"use client";

import type { Mode } from "@/lib/mode";
import { toggleModeAction } from "@/lib/actions";

interface Props {
  mode: Mode;
}

export function ModeToggle({ mode }: Props) {
  return (
    <div className="lang-toggle flex items-center gap-3 text-[12px] tracking-[0.12em] uppercase">
      <span className="label text-muted">View as</span>
      <div className="pill inline-flex border border-rule rounded-full overflow-hidden bg-bg-elev">
        <button
          type="button"
          onClick={() => toggleModeAction("reader")}
          className={
            "px-[14px] py-[6px] text-[11px] tracking-[0.12em] uppercase font-body cursor-pointer " +
            (mode === "reader"
              ? "bg-ink text-bg-elev"
              : "bg-transparent text-muted hover:text-ink")
          }
          aria-pressed={mode === "reader"}
        >
          Reader
        </button>
        <button
          type="button"
          onClick={() => toggleModeAction("contributor")}
          className={
            "px-[14px] py-[6px] text-[11px] tracking-[0.12em] uppercase font-body cursor-pointer " +
            (mode === "contributor"
              ? "bg-ink text-bg-elev"
              : "bg-transparent text-muted hover:text-ink")
          }
          aria-pressed={mode === "contributor"}
        >
          Contributor
        </button>
      </div>
    </div>
  );
}
