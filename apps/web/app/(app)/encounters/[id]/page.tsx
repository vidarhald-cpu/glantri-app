import EncounterDetail from "./EncounterDetail";

interface EncounterDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EncounterDetailPage({ params }: EncounterDetailPageProps) {
  const { id } = await params;
  return <EncounterDetail id={id} />;
}
