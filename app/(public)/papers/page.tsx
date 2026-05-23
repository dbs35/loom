import { listObjectsByType } from "@/lib/content";
import { IndexList } from "@/components/IndexList";

export const dynamic = "force-dynamic";

export default async function PapersIndex() {
  const items = await listObjectsByType("paper");
  return (
    <IndexList
      type="paper"
      title="Papers"
      description="Research, with community judgment attached. The citation is the easy part — what's rare is what practicing clinicians think of the paper, where they trust it, where they don't, how it changes practice."
      items={items}
    />
  );
}
