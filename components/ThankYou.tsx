import Link from "next/link";

import type { ObjectType } from "@/lib/parsing";

interface AffectedItem {
  object: {
    id: string;
    type: ObjectType;
    slug: string;
    canonical_name: string;
  };
  text_fragment: string;
}

const TYPE_TO_PATH: Record<ObjectType, string> = {
  program: "programs",
  paper: "papers",
  question: "questions",
  specialist: "specialists",
};

interface Props {
  affected: AffectedItem[];
  feedbackEmail: string | null;
}

export function ThankYou({ affected, feedbackEmail }: Props) {
  return (
    <div className="wrap max-w-[860px] mx-auto px-[40px] max-[900px]:px-[24px] py-16">
      <h1 className="font-display text-[48px] font-normal tracking-[-0.015em] m-0 mb-4 max-[560px]:text-[36px]">
        Thanks.
      </h1>
      {affected.length === 0 ? (
        <>
          <p className="font-display italic text-[20px] text-ink-soft mb-8 max-w-[600px]">
            We couldn&rsquo;t extract any specific mentions from your text. The
            contribution was saved, but no pages were updated.
          </p>
          <p className="font-body text-[15px] text-muted">
            If this looks wrong, try again with a different framing
            {feedbackEmail ? (
              <>
                {" "}or email{" "}
                <a href={`mailto:${feedbackEmail}`}>{feedbackEmail}</a>.
              </>
            ) : (
              "."
            )}
          </p>
        </>
      ) : (
        <>
          <p className="font-display italic text-[22px] text-ink-soft mb-10 max-w-[600px]">
            Your input updated{" "}
            {affected.length === 1 ? "this page" : `${affected.length} pages`}:
          </p>
          <ul className="list-none p-0 m-0 mb-12">
            {affected.map((a, i) => (
              <li
                key={`${a.object.id}-${i}`}
                className="py-6 border-b border-rule-soft"
              >
                <div className="text-[11px] tracking-[0.16em] uppercase text-muted font-body mb-2">
                  {a.object.type}
                </div>
                <Link
                  href={`/${TYPE_TO_PATH[a.object.type]}/${a.object.slug}`}
                  className="plain font-display text-[24px] hover:text-accent"
                >
                  {a.object.canonical_name}
                </Link>
                <p className="font-display italic text-[16px] text-ink-soft mt-3 m-0 max-w-[640px]">
                  &ldquo;{a.text_fragment}&rdquo;
                </p>
              </li>
            ))}
          </ul>
          {feedbackEmail ? (
            <p className="font-body text-[14px] text-muted">
              Looks off?{" "}
              <a href={`mailto:${feedbackEmail}`}>Let us know.</a>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
