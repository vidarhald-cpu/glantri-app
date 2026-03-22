import ResumeCharacter from "./ResumeCharacter";

interface ResumeCharacterPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ResumeCharacterPage({ params }: ResumeCharacterPageProps) {
  const { id } = await params;
  return <ResumeCharacter id={id} />;
}
