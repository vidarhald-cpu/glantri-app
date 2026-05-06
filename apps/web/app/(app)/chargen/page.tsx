import ChargenWizard from "./ChargenWizard";
import { RequireAuthenticatedUser } from "../../../src/lib/auth/RouteAccessGate";

export default function ChargenPage() {
  return (
    <RequireAuthenticatedUser
      message="You need to sign in before you can start chargen."
      title="Chargen requires login"
    >
      <ChargenWizard />
    </RequireAuthenticatedUser>
  );
}
