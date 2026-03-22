import CharacterDetail from "./CharacterDetail";

interface CharacterDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CharacterDetailPage({ params }: CharacterDetailPageProps) {
  const { id } = await params;
  return <CharacterDetail id={id} />;
}
