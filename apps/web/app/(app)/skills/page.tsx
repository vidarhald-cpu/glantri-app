import { RequireAuthenticatedUser } from "@/lib/auth/RouteAccessGate";
import { buildSkillReferenceModel } from "@/lib/skills/skillReferenceModel";
import { SkillReferenceContent } from "./SkillReferenceContent";

export default function SkillsReferencePage() {
  return (
    <RequireAuthenticatedUser
      title="Login required"
      message="Sign in to browse the Glantri Skill reference."
    >
      <SkillReferenceContent model={buildSkillReferenceModel()} />
    </RequireAuthenticatedUser>
  );
}
