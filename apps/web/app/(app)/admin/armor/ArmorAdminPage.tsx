"use client";

import { useMemo } from "react";
import { equipmentTemplates } from "@glantri/content/equipment";
import type { ArmorTemplate } from "@glantri/domain";

import { AdminPageIntro, AdminPanel } from "../admin-ui";

function formatOptionalValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }

  const text =
    typeof value === "number"
      ? Number.isInteger(value)
        ? String(value)
        : value.toFixed(2).replace(/\.?0+$/, "")
      : value.trim();
  return text.length > 0 ? text : "—";
}

function formatLocationTypes(template: ArmorTemplate): string {
  const types = template.locationTypes;
  if (!types) {
    return "—";
  }

  const entries = [
    ["Head", types.head],
    ["Front arm", types.frontArm],
    ["Chest", types.chest],
    ["Back arm", types.backArm],
    ["Abdomen", types.abdomen],
    ["Front thigh", types.frontThigh],
    ["Front foot", types.frontFoot],
    ["Back thigh", types.backThigh],
    ["Back foot", types.backFoot],
    ["General", types.generalArmor]
  ].filter(([, value]) => typeof value === "string" && value.trim().length > 0);

  return entries.length > 0
    ? entries.map(([label, value]) => `${label}: ${value}`).join(" · ")
    : "—";
}

function formatComponentNames(template: ArmorTemplate): string {
  const components = template.componentProfiles?.map((component) => component.name.trim()).filter(Boolean) ?? [];
  return components.length > 0 ? components.join(", ") : "—";
}

function TableShell(input: {
  columns: string[];
  emptyLabel: string;
  rows: string[][];
}) {
  return input.rows.length > 0 ? (
    <div style={{ overflow: "auto" }}>
      <table style={{ borderCollapse: "collapse", minWidth: "100%", width: "100%" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(85, 73, 48, 0.14)", textAlign: "left" }}>
            {input.columns.map((column) => (
              <th
                key={column}
                style={{
                  background: "rgba(250, 245, 234, 0.98)",
                  padding: "0.55rem 0.75rem 0.55rem 0",
                  verticalAlign: "bottom"
                }}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {input.rows.map((row, rowIndex) => (
            <tr key={`armor-row-${rowIndex}`} style={{ borderBottom: "1px solid rgba(85, 73, 48, 0.08)" }}>
              {row.map((value, cellIndex) => (
                <td
                  key={`armor-row-${rowIndex}-${cellIndex}`}
                  style={{ padding: "0.65rem 0.75rem 0.65rem 0", verticalAlign: "top" }}
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div>{input.emptyLabel}</div>
  );
}

export default function ArmorAdminPage() {
  const armorTemplates = useMemo(
    () =>
      [...equipmentTemplates]
        .filter(
          (template): template is ArmorTemplate =>
            template.category === "armor" && template.tags.includes("themistogenes-import")
        )
        .sort((left, right) => left.name.localeCompare(right.name)),
    []
  );

  const rows = useMemo(
    () =>
      armorTemplates.map((template) => [
        template.name,
        formatOptionalValue(template.defaultMaterial),
        formatOptionalValue(template.subtype),
        formatOptionalValue(template.armorRating),
        formatOptionalValue(template.armorActivityModifier),
        formatOptionalValue(template.perceptionModifier),
        formatOptionalValue(template.baseEncumbrance),
        formatOptionalValue(template.movementFactor ?? template.mobilityPenalty),
        formatLocationTypes(template),
        formatComponentNames(template)
      ]),
    [armorTemplates]
  );

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        eyebrow="Admin / Armor"
        title="Armor"
        summary="Read-only catalog view of system armor templates."
      />

      <AdminPanel
        title="System Armor Catalog"
        subtitle="Workbook-backed armor templates preserve Armor-sheet encumbrance, movement, AA, perception, location values, and component rows for later location-based rules work."
      >
        <TableShell
          emptyLabel="No armor templates found."
          columns={[
            "Name",
            "Material",
            "Type / subtype",
            "Armor rating",
            "AA modifier",
            "Perception modifier",
            "Encumbrance",
            "Movement modifier",
            "Locations",
            "Parts"
          ]}
          rows={rows}
        />
      </AdminPanel>
    </section>
  );
}
