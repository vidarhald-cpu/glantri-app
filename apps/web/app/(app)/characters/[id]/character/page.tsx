import CharacterLoadoutView from "../components/CharacterLoadoutView";

interface CharacterControlPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CharacterControlPage({ params }: CharacterControlPageProps) {
  const { id } = await params;

  return <CharacterLoadoutView characterId={id} />;
}
