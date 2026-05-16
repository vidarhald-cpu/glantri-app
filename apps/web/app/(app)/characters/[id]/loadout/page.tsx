import CharacterLoadoutView from "../components/CharacterLoadoutView";

interface CharacterLoadoutPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CharacterLoadoutPage({ params }: CharacterLoadoutPageProps) {
  const { id } = await params;

  return <CharacterLoadoutView characterId={id} />;
}
