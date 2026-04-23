import EncountersBrowser from "../../../../../encounters/EncountersBrowser";

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

  return <EncountersBrowser campaignId={campaignId} scenarioId={scenarioId} />;
}
