"use client";

import { AdminWorkspaceTabs } from "../admin-ui";

const tabs = [
  { href: "/admin/skill-groups", label: "Catalog Editor" },
  { href: "/admin/skill-groups/matrix", label: "Matrix Audit" },
];

export default function SkillGroupsWorkspaceTabs() {
  return <AdminWorkspaceTabs tabs={tabs} />;
}
