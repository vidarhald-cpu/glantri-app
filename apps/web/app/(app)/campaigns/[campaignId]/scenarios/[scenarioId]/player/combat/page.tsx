import ScenarioPlayerCombatPageContent from "./ScenarioPlayerCombatPageContent";

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

  return (
    <ScenarioPlayerCombatPageContent campaignId={campaignId} scenarioId={scenarioId} />
  );
}
