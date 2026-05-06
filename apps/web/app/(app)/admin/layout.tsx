import type { ReactNode } from "react";

import { RequireAuthenticatedUser } from "../../../src/lib/auth/RouteAccessGate";
import AdminLayoutShell from "./AdminLayoutShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuthenticatedUser
      message="Sign in to view the admin reference pages and editing tools."
      title="Login required"
    >
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </RequireAuthenticatedUser>
  );
}
