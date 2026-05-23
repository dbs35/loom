import { listObjectsByType } from "@/lib/content";
import { IndexList } from "@/components/IndexList";

export const dynamic = "force-dynamic";

export default async function SpecialistsIndex() {
  const items = await listObjectsByType("specialist");
  return (
    <IndexList
      type="specialist"
      title="Specialists"
      description="A factual directory of evaluators, therapists, and prescribers. MVP scope: stub entries only — name, credentials, training, region, acceptance status. Peer characterizations of specialists are out of scope for V1."
      items={items}
    />
  );
}
