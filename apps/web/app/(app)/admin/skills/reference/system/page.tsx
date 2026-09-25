"use client";

import { RequireRole } from "@/lib/auth/RouteAccessGate";
import { SkillReferenceContent } from "../SkillReferenceContent";

export default function SkillSystemReferencePage() {
  return (
    <RequireRole
      allowedRoles={["admin"]}
      message="The Skill System reference is limited to Admin accounts."
      title="Admin access required"
    >
      <SkillReferenceContent initialTab="rules" />
    </RequireRole>
  );
}
