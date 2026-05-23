import { ChatBar } from "./ChatBar";

const EXAMPLES = [
  "Social skills programs for a 14-year-old, high-masking girl",
  "Who in NYC evaluates adolescents for late-diagnosed autism?",
  "What does the research say about long-term outcomes of EIBI?",
  "How do I support a college-bound student on the spectrum?",
];

export function Hero() {
  return (
    <>
      <header className="masthead border-b border-rule text-center pt-[64px] pb-[28px]">
        <div className="wrap max-w-[1140px] mx-auto px-[40px] max-[900px]:px-[24px]">
          <div className="eyebrow text-[12px] tracking-[0.28em] uppercase text-muted mb-[22px] font-body">
            A knowledge commons for the autism community
          </div>
          <h1 className="font-display font-normal text-[clamp(48px,7vw,96px)] leading-[0.95] tracking-[-0.02em] m-0">
            Practice <em className="italic text-accent not-italic-fix font-normal" style={{ fontStyle: "italic" }}>Commons</em>
          </h1>
          <p className="font-display italic font-light text-[22px] leading-[1.4] text-ink-soft max-w-[640px] mx-auto mt-[22px]">
            What clinicians know about programs, specialists, papers, and the
            questions families keep asking — written down once, by the people
            who do the work, for everyone who needs it.
          </p>
        </div>
      </header>
      <section className="ask border-b border-rule pt-[56px] pb-[28px]">
        <div className="wrap max-w-[1140px] mx-auto px-[40px] max-[900px]:px-[24px]">
          <div className="text-[12px] tracking-[0.22em] uppercase text-muted text-center mb-[22px] font-body">
            Ask the commons
          </div>
          <ChatBar />
          <div className="max-w-[760px] mx-auto mt-[22px] flex flex-wrap gap-[10px] justify-center">
            <span className="w-full text-center text-[11px] tracking-[0.2em] uppercase text-muted font-body mb-1">
              For example
            </span>
            {EXAMPLES.map((q) => (
              <a
                key={q}
                href={`/q?query=${encodeURIComponent(q)}`}
                className="font-body italic text-[14px] text-ink-soft px-[14px] py-[7px] bg-tag-bg border border-rule rounded-full hover:bg-bg-elev hover:text-accent hover:border-accent-soft plain"
              >
                {q}
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
