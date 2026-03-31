import type { ReactNode } from "react";

import AdminLayoutShell from "./AdminLayoutShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminLayoutShell>{children}</AdminLayoutShell>;
}
