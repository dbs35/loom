import Link from "next/link";

interface Props {
  answer: string;
}

export function RefusalState({ answer }: Props) {
  return (
    <div>
      <p className="font-display italic text-[22px] leading-[1.5] text-ink-soft m-0 mb-[28px]">
        {answer}
      </p>
      <Link
        href="/contribute"
        className="plain inline-block font-body text-[13px] tracking-[0.16em] uppercase px-[22px] py-[14px] bg-ink text-bg-elev border border-ink hover:bg-accent hover:border-accent"
      >
        If you can help with this, contribute
      </Link>
    </div>
  );
}
