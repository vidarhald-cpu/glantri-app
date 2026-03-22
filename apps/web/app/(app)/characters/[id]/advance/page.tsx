import CharacterAdvance from "./CharacterAdvance";

interface CharacterAdvancePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CharacterAdvancePage({ params }: CharacterAdvancePageProps) {
  const { id } = await params;
  return <CharacterAdvance id={id} />;
}
