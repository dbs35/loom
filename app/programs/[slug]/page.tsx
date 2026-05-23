import { notFound } from "next/navigation";

import { getObjectByTypeAndSlug } from "@/lib/content";
import { getMode } from "@/lib/mode";
import { ObjectPage } from "@/components/ObjectPage";

export const dynamic = "force-dynamic";

export default async function ProgramDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const obj = await getObjectByTypeAndSlug("program", slug);
  if (!obj) notFound();
  const mode = await getMode();
  return <ObjectPage object={obj} mode={mode} />;
}
