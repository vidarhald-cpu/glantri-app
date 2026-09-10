import { FocusedBlackboardPage } from "@/features/blackboard/FocusedBlackboardPage";

interface FocusedBlackboardRouteProps {
  params: Promise<{
    campaignId: string;
  }>;
}

export default async function FocusedBlackboardRoute({ params }: FocusedBlackboardRouteProps) {
  const { campaignId } = await params;
  return <FocusedBlackboardPage campaignId={campaignId} />;
}
