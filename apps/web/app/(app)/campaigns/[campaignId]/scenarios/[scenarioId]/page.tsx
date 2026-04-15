import ScenarioDetailPageContent from "./ScenarioDetailPageContent";

interface ScenarioDetailPageProps {
  params: Promise<{
    campaignId: string;
    scenarioId: string;
  }>;
}

export default async function ScenarioDetailPage({ params }: ScenarioDetailPageProps) {
  const { campaignId, scenarioId } = await params;

  return <ScenarioDetailPageContent campaignId={campaignId} scenarioId={scenarioId} />;
}
