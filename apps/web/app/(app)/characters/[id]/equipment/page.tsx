import CharacterEquipmentEditor from "./CharacterEquipmentEditor";

interface CharacterEquipmentPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CharacterEquipmentPage({
  params
}: CharacterEquipmentPageProps) {
  const { id } = await params;
  return <CharacterEquipmentEditor id={id} />;
}
