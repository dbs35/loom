import { VoiceInterviewStatus } from "@/components/VoiceInterviewStatus";

export const dynamic = "force-dynamic";

export default async function VoiceInterviewStatusPage({
  params,
}: {
  params: Promise<{ session_id: string }>;
}) {
  const { session_id } = await params;
  return (
    <div className="wrap max-w-[860px] mx-auto px-[40px] max-[900px]:px-[24px] py-12">
      <VoiceInterviewStatus sessionId={session_id} />
    </div>
  );
}
