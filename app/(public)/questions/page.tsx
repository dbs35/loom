import { listObjectsByType } from "@/lib/content";
import { IndexList } from "@/components/IndexList";

export const dynamic = "force-dynamic";

export default async function QuestionsIndex() {
  const items = await listObjectsByType("question");
  return (
    <IndexList
      type="question"
      title="Questions"
      description="The same questions arrive again and again. Each one gets a page, synthesizing what contributors have said in response over time."
      items={items}
    />
  );
}
