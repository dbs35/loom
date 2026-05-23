import { GeneralContributeForm } from "@/components/GeneralContributeForm";

export const dynamic = "force-dynamic";

export default function ContributePage() {
  return (
    <div className="wrap max-w-[860px] mx-auto px-[40px] max-[900px]:px-[24px] py-12">
      <div className="text-[11px] tracking-[0.22em] uppercase text-muted font-body mb-3">
        General contribution
      </div>
      <h1 className="font-display text-[44px] font-normal tracking-[-0.015em] m-0 mb-4 max-[560px]:text-[32px]">
        Paste a transcript, notes, or general thoughts.
      </h1>
      <p className="font-display italic text-[18px] text-ink-soft mb-8 max-w-[640px]">
        The system extracts mentions of programs, papers, and questions, and
        folds them into the relevant pages. Raw text is never reproduced.
      </p>
      <GeneralContributeForm />
    </div>
  );
}
