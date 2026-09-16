"use client";

import { RequireRole } from "@/lib/auth/RouteAccessGate";
import { LearningGroupReferenceContent } from "./LearningGroupReferenceContent";

export default function LearningGroupReferencePage() {
  return (
    <RequireRole
      allowedRoles={["admin"]}
      message="Learning Group Reference is limited to Admin accounts."
      title="Admin access required"
    >
      <LearningGroupReferenceContent />
    </RequireRole>
  );
}
