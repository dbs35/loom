import Link from "next/link";

import { Hero } from "@/components/Hero";

const CARDS = [
  {
    n: "01",
    title: "Programs",
    sub: "Schools, IOPs, social groups, day treatment",
    body: "One page per program. Who it's for, who it isn't, what's changed recently. Contributions noted by indication, not flat endorsements.",
    href: "/programs",
  },
  {
    n: "02",
    title: "Papers",
    sub: "Research, with community judgment attached",
    body: "The citation is the easy part. What's rare: what practicing clinicians think of the paper, where they trust it, where they don't, how it changes practice.",
    href: "/papers",
  },
  {
    n: "03",
    title: "Questions",
    sub: "What parents, pediatricians, and clinicians keep asking",
    body: "The same questions arrive again and again. Each one gets a page, synthesizing what contributors have said in response over time.",
    href: "/questions",
  },
  {
    n: "04",
    title: "Specialists",
    sub: "Stub directory of evaluators, therapists, prescribers",
    body: "MVP scope: factual stubs only — name, credentials, training, region, current acceptance status. Peer characterizations of specialists are out of scope for V1.",
    href: "/specialists",
  },
];

const AUDIENCE = [
  {
    name: "Parents and caregivers",
    note: "Programs, specialists, what to ask, what worked for whom",
  },
  {
    name: "Self-advocates",
    note: "Adults seeking evaluation or community",
  },
  {
    name: "Pediatricians",
    note: "The frontline. Often the first to notice; rarely told what to do next",
  },
  {
    name: "School and preschool directors",
    note: "Children fall through cracks here. This is the gap",
  },
  {
    name: "School psychologists",
    note: "Differential, referrals, what each evaluator actually does",
  },
  {
    name: "Specialists across the spectrum of care",
    note: "Psychiatrists, psychologists, SLPs, OTs, ABA practitioners",
  },
];

export default function HomePage() {
  return (
    <>
      <Hero />

      <section className="premise border-b border-rule py-[80px_60px]">
        <div className="wrap max-w-[1140px] mx-auto px-[40px] max-[900px]:px-[24px]">
          <div className="grid grid-cols-2 gap-[64px] max-[900px]:grid-cols-1 max-[900px]:gap-8">
            <div>
              <h2 className="font-body font-normal text-[11px] tracking-[0.28em] uppercase text-muted mb-[18px]">
                For all stakeholders
              </h2>
              <p className="font-display text-[38px] leading-[1.1] tracking-[-0.015em] m-0 mb-4">
                Parents, pediatricians, school directors, clinicians,
                self-advocates — <em className="italic text-accent">anyone</em>{" "}
                can read.
              </p>
              <p className="text-[16px] text-ink-soft m-0 mb-3">
                Most useful information about programs, providers, and what
                actually helps lives in clinicians&rsquo; heads and decays in
                inboxes. This site exists so it doesn&rsquo;t have to.
              </p>
            </div>
            <div>
              <h2 className="font-body font-normal text-[11px] tracking-[0.28em] uppercase text-muted mb-[18px]">
                By a small group of practitioners
              </h2>
              <p className="font-display text-[38px] leading-[1.1] tracking-[-0.015em] m-0 mb-4">
                Only licensed clinicians and allied practitioners{" "}
                <em className="italic text-accent">contribute</em>. Everyone
                else can read freely.
              </p>
              <p className="text-[16px] text-ink-soft m-0 mb-3">
                That&rsquo;s the deal: a closed door on input, an open door on
                output. The quality of what&rsquo;s in here is the whole point,
                and quality requires gatekeeping that part of it.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="inside border-b border-rule py-[80px_64px]">
        <div className="wrap max-w-[1140px] mx-auto px-[40px] max-[900px]:px-[24px]">
          <div className="flex justify-between items-baseline mb-[36px] border-b border-ink pb-[14px] max-[560px]:flex-col max-[560px]:items-start max-[560px]:gap-[6px]">
            <h2 className="font-display text-[36px] font-normal tracking-[-0.015em] m-0">
              What&rsquo;s inside
            </h2>
            <span className="text-[12px] tracking-[0.22em] uppercase text-muted font-body">
              Four kinds of pages
            </span>
          </div>
          <div className="grid grid-cols-4 gap-[30px] max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
            {CARDS.map((c) => (
              <Link
                key={c.title}
                href={c.href}
                className="card plain bg-bg-elev border border-rule p-[28px] flex flex-col hover:border-accent-soft transition-colors"
              >
                <div className="font-display text-[14px] tracking-[0.2em] text-accent mb-[18px]">
                  № {c.n}
                </div>
                <h3 className="font-display text-[26px] font-medium m-0 mb-[10px] tracking-[-0.01em]">
                  {c.title}
                </h3>
                <div className="font-display italic text-[14px] text-muted mb-[16px]">
                  {c.sub}
                </div>
                <p className="text-[14.5px] m-0 text-ink-soft leading-[1.55]">
                  {c.body}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="audience border-b border-rule py-[80px_60px]">
        <div className="wrap max-w-[1140px] mx-auto px-[40px] max-[900px]:px-[24px]">
          <div className="grid grid-cols-[320px_1fr] gap-[80px] items-start max-[900px]:grid-cols-1 max-[900px]:gap-8">
            <div>
              <h2 className="font-display text-[40px] leading-[1.05] font-normal tracking-[-0.015em] m-0">
                Built for the people{" "}
                <em className="italic text-accent">making the next move</em>.
              </h2>
              <p className="font-display italic font-light text-[18px] text-ink-soft mt-4">
                A parent figuring out the next step. A pediatrician who saw
                something in a 15-minute visit and isn&rsquo;t sure where to
                send the family. A preschool director seeing a child who
                doesn&rsquo;t quite fit. The clinician deciding which program
                to recommend this summer.
              </p>
            </div>
            <ul className="list-none p-0 m-0 columns-2 gap-[60px] max-[900px]:columns-1">
              {AUDIENCE.map((a) => (
                <li
                  key={a.name}
                  className="break-inside-avoid py-[18px] border-b border-rule-soft flex flex-col gap-1"
                >
                  <strong className="font-display text-[19px] font-medium tracking-[-0.005em]">
                    {a.name}
                  </strong>
                  <span className="text-[14px] text-muted font-body italic">
                    {a.note}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="quality border-b border-rule py-[80px_90px] bg-ink text-bg">
        <div className="wrap max-w-[820px] mx-auto px-[40px] max-[900px]:px-[24px] text-center">
          <div className="text-[12px] tracking-[0.28em] uppercase text-accent-soft mb-[24px] font-body">
            Why trust what&rsquo;s in here
          </div>
          <blockquote className="font-display text-[36px] leading-[1.25] font-light tracking-[-0.01em] m-0 italic max-[900px]:text-[26px]">
            Most of the internet about autism is either marketing or argument.
            <br />
            This site is{" "}
            <em className="not-italic text-accent-soft" style={{ fontStyle: "normal" }}>
              neither
            </em>
            . It is what practicing clinicians actually do, written down.
          </blockquote>
          <div className="mt-[38px] text-[13px] tracking-[0.18em] uppercase text-muted font-body">
            For all stakeholders &middot; By a small group of stakeholders
          </div>
          <div className="grid grid-cols-3 gap-[36px] mt-[52px] text-left max-[900px]:grid-cols-1">
            <div>
              <div className="font-display text-[12px] tracking-[0.2em] text-accent-soft mb-[12px]">
                № 01
              </div>
              <h4 className="font-display text-[19px] font-medium m-0 mb-2 text-bg">
                Vetted contributors
              </h4>
              <p className="text-[14.5px] leading-[1.55] text-[#B5AC9D] m-0">
                Every contributor is a licensed clinician or credentialed
                allied practitioner. (V2: membership review and attribution
                tooling. MVP: no auth gate, mode toggle only.)
              </p>
            </div>
            <div>
              <div className="font-display text-[12px] tracking-[0.2em] text-accent-soft mb-[12px]">
                № 02
              </div>
              <h4 className="font-display text-[19px] font-medium m-0 mb-2 text-bg">
                Specifics, not slogans
              </h4>
              <p className="text-[14.5px] leading-[1.55] text-[#B5AC9D] m-0">
                Pages describe what programs and providers actually do in
                practice — including where the practice falls short. No
                advertising. No editorial pressure from the providers being
                described.
              </p>
            </div>
            <div>
              <div className="font-display text-[12px] tracking-[0.2em] text-accent-soft mb-[12px]">
                № 03
              </div>
              <h4 className="font-display text-[19px] font-medium m-0 mb-2 text-bg">
                Updated as practice changes
              </h4>
              <p className="text-[14.5px] leading-[1.55] text-[#B5AC9D] m-0">
                When a director leaves, a methodology shifts, or a waitlist
                opens, the relevant page updates. Old observations stay visible
                with their date.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="commitment border-b border-rule py-[84px] bg-bg">
        <div className="wrap max-w-[1140px] mx-auto px-[40px] max-[900px]:px-[24px]">
          <div className="max-w-[720px] mx-auto text-center">
            <div className="w-[28px] h-px bg-accent mx-auto mb-[30px]" />
            <div className="text-[12px] tracking-[0.28em] uppercase text-muted mb-[30px] font-body">
              A standing commitment to contributors
            </div>
            <p className="font-display text-[32px] leading-[1.25] font-normal tracking-[-0.012em] m-0 mb-[26px] text-ink">
              Nothing you share with the site is{" "}
              <em className="italic text-accent">ever</em> quoted directly —
              here, or anywhere else — without your explicit permission.
            </p>
            <p className="font-display italic font-light text-[17px] leading-[1.6] text-ink-soft m-0 mx-auto max-w-[580px]">
              Contributions are synthesized into the pages above. Raw text is
              never reproduced. We don&rsquo;t lift quotes for press, research
              output, marketing, or external communications.
            </p>
          </div>
        </div>
      </section>

      <section className="cta border-b border-rule py-[60px]">
        <div className="wrap max-w-[1140px] mx-auto px-[40px] max-[900px]:px-[24px]">
          <div className="grid grid-cols-2 gap-[60px] items-center max-[900px]:grid-cols-1 max-[900px]:gap-8">
            <div>
              <h3 className="font-display text-[30px] font-normal tracking-[-0.01em] m-0 mb-[10px]">
                Are you a clinician?
              </h3>
              <p className="text-ink-soft m-0 text-[15px]">
                Flip to Contributor mode in the top bar, then paste a
                transcript, notes, or thoughts into the contribute page.
                Fifteen minutes once, and your knowledge stops decaying.
              </p>
            </div>
            <div className="flex gap-[14px] flex-wrap">
              <Link
                href="/contribute"
                className="plain inline-block font-body text-[13px] tracking-[0.16em] uppercase px-[22px] py-[14px] bg-ink text-bg-elev border border-ink hover:bg-accent hover:border-accent"
              >
                Contribute
              </Link>
              <Link
                href="/programs"
                className="plain inline-block font-body text-[13px] tracking-[0.16em] uppercase px-[22px] py-[14px] border border-ink text-ink hover:bg-ink hover:text-bg-elev"
              >
                Browse the commons
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
