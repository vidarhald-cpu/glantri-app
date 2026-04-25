import { redirect } from "next/navigation";

import { buildCampaignWorkspaceHref } from "../../../../../../../../src/lib/campaigns/workspace";

interface ScenarioPlayerCombatPageProps {
  params: Promise<{
    campaignId: string;
    scenarioId: string;
  }>;
}

export default async function ScenarioPlayerCombatPage({
  params,
}: ScenarioPlayerCombatPageProps) {
  const { campaignId, scenarioId } = await params;

  redirect(
    buildCampaignWorkspaceHref({
      campaignId,
      scenarioId,
      tab: "player-encounter",
    }),
  );
}
