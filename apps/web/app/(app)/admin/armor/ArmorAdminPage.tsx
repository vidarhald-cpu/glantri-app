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
        : value.toFixed(2)
      : value.trim();
  return text.length > 0 ? text : "—";
}

function formatGeneralArmor(template: ArmorTemplate): string {
  if (template.armorRating === null || template.armorRating === undefined) {
    return "—";
  }

  const rounded = template.generalArmorRounded;
  return rounded === null || rounded === undefined
    ? formatOptionalValue(template.armorRating)
    : `${formatOptionalValue(template.armorRating)} -> ${rounded}`;
}

function formatLocationValues(template: ArmorTemplate): string {
  const values = template.locationValues;
  if (!values) {
    return "—";
  }

  const entries = [
    ["Hd", values.head],
    ["FA", values.frontArm],
    ["Ch", values.chest],
    ["BA", values.backArm],
    ["Ab", values.abdomen],
    ["FT", values.frontThigh],
    ["FF", values.frontFoot],
    ["BT", values.backThigh],
    ["BF", values.backFoot]
  ].filter(([, value]) => value !== null && value !== undefined);

  return entries.length > 0
    ? entries.map(([label, value]) => `${label} ${formatOptionalValue(value)}`).join(" · ")
    : "—";
}

function formatComponentNames(template: ArmorTemplate): string {
  const components = template.componentProfiles?.map((component) => component.name.trim()).filter(Boolean) ?? [];
  return components.length > 0 ? components.join(", ") : "—";
}

function formatCriticalModifiers(template: ArmorTemplate): string {
  const values = template.criticalModifierByArea;
  if (!values) {
    return template.criticalModifierGeneral === null || template.criticalModifierGeneral === undefined
      ? "—"
      : `Gen ${template.criticalModifierGeneral}`;
  }

  const entries = [
    ["Hd", values.head],
    ["FA", values.frontArm],
    ["Ch", values.chest],
    ["BA", values.backArm],
    ["Ab", values.abdomen],
    ["FT", values.frontThigh],
    ["FF", values.frontFoot],
    ["BT", values.backThigh],
    ["BF", values.backFoot]
  ].filter(([, value]) => value !== null && value !== undefined);

  if (template.criticalModifierGeneral !== null && template.criticalModifierGeneral !== undefined) {
    entries.push(["Gen", template.criticalModifierGeneral]);
  }

  return entries.length > 0
    ? entries.map(([label, value]) => `${label} ${formatOptionalValue(value)}`).join(" · ")
    : "—";
}

function formatTypeSummary(template: ArmorTemplate): string {
  const generalType = template.locationTypes?.generalArmor?.trim();
  if (template.subtype && generalType) {
    return `${template.subtype} / ${generalType}`;
  }

  return formatOptionalValue(template.subtype ?? generalType ?? null);
}

function TableShell(input: {
  columns: string[];
  emptyLabel: string;
  rows: string[][];
}) {
  return input.rows.length > 0 ? (
    <div style={{ maxHeight: "70vh", overflow: "auto" }}>
      <table style={{ borderCollapse: "collapse", minWidth: "100%", width: "100%" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(85, 73, 48, 0.14)", textAlign: "left" }}>
            {input.columns.map((column) => (
              <th
                key={column}
                style={{
                  background: "rgba(250, 245, 234, 0.98)",
                  padding: "0.55rem 0.75rem 0.55rem 0",
                  position: "sticky",
                  top: 0,
                  verticalAlign: "bottom",
                  zIndex: 1
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
        formatTypeSummary(template),
        formatComponentNames(template),
        formatLocationValues(template),
        formatGeneralArmor(template),
        formatOptionalValue(template.armorActivityModifier),
        formatOptionalValue(template.perceptionModifier),
        formatCriticalModifiers(template),
        formatOptionalValue(template.encumbranceFactor ?? template.baseEncumbrance),
        "Factor x size",
        formatOptionalValue(template.movementFactor ?? template.mobilityPenalty),
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
        subtitle="Workbook-backed armor templates preserve component rows, per-area protection, rounded general armor, critical modifiers, and the workbook encumbrance-factor rule."
      >
        <TableShell
          emptyLabel="No armor templates found."
          columns={[
            "Name",
            "Material",
            "Type / subtype",
            "Components",
            "Per-area protection",
            "General armor",
            "AA modifier",
            "Perception modifier",
            "Critical modifiers",
            "Encumbrance factor",
            "Final encumbrance",
            "Movement modifier",
          ]}
          rows={rows}
        />
      </AdminPanel>
    </section>
  );
}
