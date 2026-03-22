import CharacterSheet from "./CharacterSheet";

interface CharacterSheetPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CharacterSheetPage({ params }: CharacterSheetPageProps) {
  const { id } = await params;
  return <CharacterSheet id={id} />;
}
