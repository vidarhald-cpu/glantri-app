"use client";

import { AdminWorkspaceTabs } from "../admin-ui";

const tabs = [
  { href: "/admin/skills", label: "Catalog Editor" },
  { href: "/admin/skills/matrix", label: "Matrix Audit" },
];

export default function SkillsWorkspaceTabs() {
  return <AdminWorkspaceTabs tabs={tabs} />;
}
