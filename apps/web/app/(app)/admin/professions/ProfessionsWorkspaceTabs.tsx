"use client";

import { AdminWorkspaceTabs } from "../admin-ui";

const tabs = [
  { href: "/admin/professions", label: "Catalog Editor" },
  { href: "/admin/professions/matrix", label: "Matrix Audit" },
];

export default function ProfessionsWorkspaceTabs() {
  return <AdminWorkspaceTabs tabs={tabs} />;
}
