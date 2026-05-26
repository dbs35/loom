import type { ObjectRow } from "@/lib/content";
import type { Mode } from "@/lib/mode";

import { ObjectHeader } from "./ObjectHeader";
import { ObjectFrontmatter } from "./ObjectFrontmatter";
import { ObjectBody } from "./ObjectBody";
import { ContributorForm } from "./ContributorForm";
import { DemoBanner } from "./DemoBanner";

interface Props {
  object: ObjectRow;
  mode: Mode;
}

function formatLastUpdated(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ObjectPage({ object, mode }: Props) {
  const isStub = object.type === "specialist";
  const lastUpdated = formatLastUpdated(object.last_synthesized_at);

  return (
    <>
      <DemoBanner />
      <div className="wrap max-w-[860px] mx-auto px-[40px] max-[900px]:px-[24px] py-12">
        <ObjectHeader
          type={object.type}
          canonicalName={object.canonical_name}
          aliases={object.aliases}
        />

        <section className="mb-10">
          <div className="text-[11px] tracking-[0.22em] uppercase text-muted font-body mb-4">
            Profile
          </div>
          <ObjectFrontmatter frontmatter={object.frontmatter} />
        </section>

        <section className="mb-10">
          {isStub ? (
            <p className="font-display italic text-[17px] text-muted m-0 max-w-[600px]">
              Specialists are listed as factual stubs in this MVP. Peer
              characterizations of specialists are out of scope for V1.
            </p>
          ) : (
            <ObjectBody body={object.body} />
          )}
        </section>

        {!isStub && mode === "contributor" ? (
          <section className="mt-12 pt-10 border-t border-rule">
            <ContributorForm
              pageContextType={object.type}
              pageContextSlug={object.slug}
              canonicalName={object.canonical_name}
            />
          </section>
        ) : null}

        {lastUpdated ? (
          <p className="mt-12 pt-6 border-t border-rule-soft text-[11px] tracking-[0.16em] uppercase text-muted font-body">
            Last updated: {lastUpdated}
          </p>
        ) : null}
      </div>
    </>
  );
}
