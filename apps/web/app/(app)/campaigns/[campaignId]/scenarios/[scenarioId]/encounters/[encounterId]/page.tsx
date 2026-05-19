import { redirect } from "next/navigation";

import { buildCampaignWorkspaceHref } from "@/lib/campaigns/workspace";

interface ScenarioEncounterDetailPageProps {
  params: Promise<{
    campaignId: string;
    encounterId: string;
    scenarioId: string;
  }>;
}

export default async function ScenarioEncounterDetailPage({
  params
}: ScenarioEncounterDetailPageProps) {
  const { campaignId, encounterId, scenarioId } = await params;

  redirect(
    buildCampaignWorkspaceHref({
      campaignId,
      encounterId,
      scenarioId,
      tab: "encounter",
    }),
  );
}
