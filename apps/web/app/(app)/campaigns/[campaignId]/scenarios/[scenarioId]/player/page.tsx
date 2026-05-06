import { redirect } from "next/navigation";

import { buildCampaignWorkspaceHref } from "../../../../../../../src/lib/campaigns/workspace";

interface ScenarioPlayerPageProps {
  params: Promise<{
    campaignId: string;
    scenarioId: string;
  }>;
}

export default async function ScenarioPlayerPage({ params }: ScenarioPlayerPageProps) {
  const { campaignId, scenarioId } = await params;

  redirect(
    buildCampaignWorkspaceHref({
      campaignId,
      scenarioId,
      tab: "player-encounter",
    }),
  );
}
