import type { ObjectType } from "@/lib/parsing";

interface Props {
  type: ObjectType;
  canonicalName: string;
  aliases: string[];
}

const TYPE_LABEL: Record<ObjectType, string> = {
  program: "Program",
  paper: "Paper",
  question: "Question",
  specialist: "Specialist",
};

export function ObjectHeader({ type, canonicalName, aliases }: Props) {
  const goodAliases = (aliases ?? []).filter(
    (a) => typeof a === "string" && a.trim().length > 0,
  );
  return (
    <header className="mb-10 pb-8 border-b border-rule">
      <div className="text-[12px] tracking-[0.22em] uppercase text-muted font-body mb-3">
        {TYPE_LABEL[type]}
      </div>
      <h1 className="font-display text-[44px] leading-[1.05] font-normal tracking-[-0.012em] m-0 max-[560px]:text-[32px]">
        {canonicalName}
      </h1>
      {goodAliases.length > 0 ? (
        <p className="font-display italic text-[15px] text-muted mt-3 m-0">
          Also: {goodAliases.join(" · ")}
        </p>
      ) : null}
    </header>
  );
}
