import Link from "next/link";

import { runChatBar } from "@/lib/chatbar";
import { ChatBar } from "@/components/ChatBar";
import { ChatResult } from "@/components/ChatResult";
import { DemoBanner } from "@/components/DemoBanner";
import { RefusalState } from "@/components/RefusalState";
import type { ObjectType } from "@/lib/parsing";

export const dynamic = "force-dynamic";

const TYPE_TO_PATH: Record<ObjectType, string> = {
  program: "programs",
  paper: "papers",
  question: "questions",
  specialist: "specialists",
};

interface SearchParams {
  query?: string | string[];
}

export default async function QPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const queryRaw = params.query;
  const query =
    Array.isArray(queryRaw) ? queryRaw[0] : queryRaw;

  if (!query || query.trim().length === 0) {
    return (
      <div className="wrap max-w-[1140px] mx-auto px-[40px] max-[900px]:px-[24px] pt-12 pb-16">
        <p className="font-display italic text-[20px] text-ink-soft mb-6 text-center">
          Ask something specific.
        </p>
        <ChatBar />
      </div>
    );
  }

  const result = await runChatBar(query.trim());

  return (
    <>
      <DemoBanner />
      <div className="wrap max-w-[1140px] mx-auto px-[40px] max-[900px]:px-[24px] py-12">
        <div className="mb-10 pb-6 border-b border-rule">
          <div className="text-[11px] tracking-[0.22em] uppercase text-muted font-body mb-3">
            You asked
          </div>
          <p className="font-display italic text-[28px] leading-[1.3] text-ink m-0 max-[900px]:text-[22px]">
            {query}
          </p>
        </div>

        <div className="grid grid-cols-[1fr_280px] gap-[60px] max-[900px]:grid-cols-1 max-[900px]:gap-10">
          <div>
            {result.was_refusal ? (
              <RefusalState answer={result.answer_text} />
            ) : (
              <ChatResult
                answer={result.answer_text}
                citedObjects={result.cited_objects}
              />
            )}
          </div>

          <aside className="border-l border-rule pl-8 max-[900px]:border-l-0 max-[900px]:border-t max-[900px]:pl-0 max-[900px]:pt-10">
            {result.was_refusal ? null : result.cited_objects.length === 0 ? (
              <p className="text-[14px] text-muted font-body italic">
                No objects cited.
              </p>
            ) : (
              <>
                <div className="text-[11px] tracking-[0.22em] uppercase text-muted font-body mb-4">
                  Sources
                </div>
                <ol className="list-none p-0 m-0 space-y-4">
                  {result.cited_objects.map((obj, i) => (
                    <li key={obj.id} className="text-[14px] leading-[1.4]">
                      <div className="text-muted text-[11px] font-body uppercase tracking-[0.16em] mb-1">
                        [{i + 1}] {obj.type}
                      </div>
                      <Link
                        href={`/${TYPE_TO_PATH[obj.type]}/${obj.slug}`}
                        className="plain font-display text-[17px] hover:text-accent"
                      >
                        {obj.canonical_name}
                      </Link>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </aside>
        </div>

        <div className="mt-16 pt-8 border-t border-rule">
          <div className="text-[12px] tracking-[0.22em] uppercase text-muted font-body mb-4 text-center">
            Ask another
          </div>
          <ChatBar />
        </div>
      </div>
    </>
  );
}
