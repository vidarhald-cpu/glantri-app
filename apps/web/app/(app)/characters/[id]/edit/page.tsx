import { RequireRole } from "../../../../../src/lib/auth/RouteAccessGate";
import CharacterEditPage from "./CharacterEditPage";

interface CharacterEditRouteProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function Page({ params }: CharacterEditRouteProps) {
  const { id } = await params;

  return (
    <RequireRole
      allowedRoles={["game_master"]}
      message="This character edit page is limited to GM accounts."
      title="GM access required"
    >
      <CharacterEditPage id={id} />
    </RequireRole>
  );
}
