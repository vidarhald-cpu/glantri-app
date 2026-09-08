"use client";

import { RequireRole } from "@/lib/auth/RouteAccessGate";
import { SkillReferenceContent } from "./SkillReferenceContent";

export default function SkillReferencePage() {
  return (
    <RequireRole
      allowedRoles={["admin"]}
      message="Skill Reference is limited to Admin accounts."
      title="Admin access required"
    >
      <SkillReferenceContent />
    </RequireRole>
  );
}
