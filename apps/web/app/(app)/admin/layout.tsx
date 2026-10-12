import type { ReactNode } from "react";

import { RequireRole } from "@/lib/auth/RouteAccessGate";
import AdminLayoutShell from "./AdminLayoutShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole
      allowedRoles={["admin", "game_master"]}
      message="The admin reference pages and editing tools are limited to Admin and GM accounts."
      title="Admin access required"
    >
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </RequireRole>
  );
}
