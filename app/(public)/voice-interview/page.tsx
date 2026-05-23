import { VoiceInterviewForm } from "@/components/VoiceInterviewForm";

export const dynamic = "force-dynamic";

export default function VoiceInterviewPage() {
  return (
    <div className="wrap max-w-[860px] mx-auto px-[40px] max-[900px]:px-[24px] py-12">
      <div className="text-[11px] tracking-[0.22em] uppercase text-muted font-body mb-3">
        Voice contribution
      </div>
      <h1 className="font-display text-[44px] font-normal tracking-[-0.015em] m-0 mb-4 max-[560px]:text-[32px]">
        Start a voice interview.
      </h1>
      <p className="font-display italic text-[18px] text-ink-soft mb-8 max-w-[640px]">
        A short conversation — 8 to 15 minutes — with an interviewer who asks
        about the programs you refer to, the papers you find useful, and the
        questions you hear from families. The transcript is extracted into the
        corpus. Raw text is never reproduced.
      </p>
      <VoiceInterviewForm />
    </div>
  );
}
