import ScenarioPlayerPageContent from "./ScenarioPlayerPageContent";

interface ScenarioPlayerPageProps {
  params: Promise<{
    scenarioId: string;
  }>;
}

export default async function ScenarioPlayerPage({ params }: ScenarioPlayerPageProps) {
  const { scenarioId } = await params;

  return <ScenarioPlayerPageContent scenarioId={scenarioId} />;
}
