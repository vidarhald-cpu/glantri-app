import EncounterDetail from "../../../../../../encounters/[id]/EncounterDetail";

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

  return (
    <EncounterDetail
      campaignId={campaignId}
      id={encounterId}
      scenarioId={scenarioId}
    />
  );
}
