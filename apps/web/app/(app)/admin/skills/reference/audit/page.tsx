"use client";

import { RequireRole } from "@/lib/auth/RouteAccessGate";
import { SkillReferenceAuditContent } from "./SkillReferenceAuditContent";

export default function SkillReferenceAuditPage() {
  return (
    <RequireRole
      allowedRoles={["admin"]}
      message="The Skill Reference audit is limited to Admin accounts."
      title="Admin access required"
    >
      <SkillReferenceAuditContent />
    </RequireRole>
  );
}
