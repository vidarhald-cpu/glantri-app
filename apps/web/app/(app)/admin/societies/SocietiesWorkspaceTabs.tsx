"use client";

import { AdminWorkspaceTabs } from "../admin-ui";

const tabs = [
  { href: "/admin/societies", label: "Catalog Editor" },
  { href: "/admin/societies/matrix", label: "Matrix Audit" },
];

export default function SocietiesWorkspaceTabs() {
  return <AdminWorkspaceTabs tabs={tabs} />;
}
