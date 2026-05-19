import { redirect } from "next/navigation";

import { buildCampaignWorkspaceHref } from "@/lib/campaigns/workspace";

interface ScenarioEncountersPageProps {
  params: Promise<{
    campaignId: string;
    scenarioId: string;
  }>;
}

export default async function ScenarioEncountersPage({
  params
}: ScenarioEncountersPageProps) {
  const { campaignId, scenarioId } = await params;

  redirect(
    buildCampaignWorkspaceHref({
      campaignId,
      scenarioId,
      tab: "encounter",
    }),
  );
}
