import { listObjectsByType } from "@/lib/content";
import { IndexList } from "@/components/IndexList";

export const dynamic = "force-dynamic";

export default async function ProgramsIndex() {
  const items = await listObjectsByType("program");
  return (
    <IndexList
      type="program"
      title="Programs"
      description="Schools, IOPs, social groups, day treatment. One page per program — who it's for, who it isn't, what's changed recently."
      items={items}
    />
  );
}
