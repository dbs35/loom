import Link from "next/link";

import { getMode } from "@/lib/mode";
import { ModeToggle } from "./ModeToggle";

export async function TopBar() {
  const mode = await getMode();

  return (
    <div className="topbar border-b border-rule bg-bg text-muted">
      <div className="wrap max-w-[1140px] mx-auto px-[40px] max-[900px]:px-[24px] flex justify-between items-center py-[14px] gap-4 flex-wrap">
        <div className="flex items-center gap-6 text-[12px] tracking-[0.12em] uppercase">
          <Link href="/" className="plain inline-flex items-center gap-[10px]">
            <span className="w-[7px] h-[7px] bg-accent rounded-full inline-block" />
            <span className="font-display italic text-ink">Practice Commons</span>
          </Link>
          {mode === "contributor" ? (
            <nav className="flex gap-5 text-[11px]">
              <Link href="/contribute" className="plain text-muted hover:text-ink">
                Contribute
              </Link>
              <Link
                href="/voice-interview"
                className="plain text-muted hover:text-ink"
              >
                Start a voice interview
              </Link>
            </nav>
          ) : null}
        </div>
        <ModeToggle mode={mode} />
      </div>
    </div>
  );
}
