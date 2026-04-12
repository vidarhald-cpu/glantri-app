"use client";

import { useMemo } from "react";
import { equipmentTemplates } from "@glantri/content/equipment";
import type { ArmorTemplate } from "@glantri/domain";

import { AdminPageIntro, AdminPanel } from "../admin-ui";

type ArmorDisplayRow = {
  cells: string[];
  kind: "armor" | "component";
};

const LOCATION_COLUMNS: Array<{
  key:
    | "head"
    | "frontArm"
    | "chest"
    | "backArm"
    | "abdomen"
    | "frontThigh"
    | "frontFoot"
    | "backThigh"
    | "backFoot";
  label: string;
}> = [
  { key: "head", label: "Head" },
  { key: "frontArm", label: "Front Arm" },
  { key: "chest", label: "Chest" },
  { key: "backArm", label: "Back Arm" },
  { key: "abdomen", label: "Abdomen" },
  { key: "frontThigh", label: "Front Thigh" },
  { key: "frontFoot", label: "Front Foot" },
  { key: "backThigh", label: "Back Thigh" },
  { key: "backFoot", label: "Back Foot" },
];

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

function formatWorkbookWholeNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return String(Math.round(value));
}

function formatMainLocationCell(template: ArmorTemplate, key: keyof NonNullable<ArmorTemplate["locationValues"]>): string {
  const value = template.locationValues?.[key];
  if (value === null || value === undefined) {
    return "—";
  }

  const typeByKey = template.locationTypes?.[key];
  return `${formatWorkbookWholeNumber(value)}${typeByKey?.trim() ?? ""}`;
}

function formatMainGeneralArmorCell(template: ArmorTemplate): string {
  const rounded = template.generalArmorRounded ?? (template.armorRating === null || template.armorRating === undefined
    ? null
    : Math.round(template.armorRating));
  if (rounded === null || rounded === undefined) {
    return "—";
  }

  const generalType = template.locationTypes?.generalArmor?.trim() ?? "";
  return `${rounded}${generalType}`;
}

function formatComponentLabel(rawName: string | null | undefined): string {
  const name = rawName?.trim() ?? "";
  if (!name || name.startsWith("Unnamed component")) {
    return "";
  }

  return `\u00A0\u00A0${name}`;
}

function formatComponentLocationCell(template: ArmorTemplate, index: number, key: keyof NonNullable<ArmorTemplate["locationValues"]>): string {
  const component = template.componentProfiles?.[index];
  const value = component?.locationValues?.[key];
  if (value === null || value === undefined) {
    return "—";
  }

  return formatWorkbookWholeNumber(value);
}

function TableShell(input: {
  columns: string[];
  emptyLabel: string;
  rows: ArmorDisplayRow[];
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
            <tr
              key={`armor-row-${rowIndex}`}
              style={{
                background: row.kind === "component" ? "rgba(250, 245, 234, 0.38)" : undefined,
                borderBottom: "1px solid rgba(85, 73, 48, 0.08)"
              }}
            >
              {row.cells.map((value, cellIndex) => (
                <td
                  key={`armor-row-${rowIndex}-${cellIndex}`}
                  style={{
                    color: row.kind === "component" ? "rgba(85, 73, 48, 0.88)" : undefined,
                    padding: "0.65rem 0.75rem 0.65rem 0",
                    verticalAlign: "top"
                  }}
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
        .sort((left, right) => {
          return left.name.localeCompare(right.name);
        }),
    []
  );

  const rows = useMemo(
    () =>
      armorTemplates.flatMap((template) => {
        const armorRow: ArmorDisplayRow = {
          kind: "armor",
          cells: [
            template.name,
            formatOptionalValue(template.encumbranceFactor ?? template.baseEncumbrance),
            formatOptionalValue(template.movementFactor ?? template.mobilityPenalty),
            ...LOCATION_COLUMNS.map(({ key }) => formatMainLocationCell(template, key)),
            formatMainGeneralArmorCell(template),
            formatOptionalValue(template.armorActivityModifier),
            formatOptionalValue(template.perceptionModifier),
          ],
        };

        const componentRows: ArmorDisplayRow[] = (template.componentProfiles ?? []).map((component, index) => ({
          kind: "component",
          cells: [
            formatComponentLabel(component.name),
            formatOptionalValue(component.encumbranceFactor),
            formatOptionalValue(component.movementFactor),
            ...LOCATION_COLUMNS.map(({ key }) => formatComponentLocationCell(template, index, key)),
            formatWorkbookWholeNumber(component.generalArmorRounded ?? component.generalArmor),
            "—",
            formatOptionalValue(component.perceptionModifier),
          ],
        }));

        return [armorRow, ...componentRows];
      }),
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
        subtitle="Workbook-backed armor templates are shown as finished armor rows with component sub-lines, close to the original Armor sheet layout."
      >
        <TableShell
          emptyLabel="No armor templates found."
          columns={[
            "Name",
            "Enc. factor",
            "MM. factor",
            ...LOCATION_COLUMNS.map(({ label }) => label),
            "Gen. Armor",
            "AA. mod",
            "Per. Mod",
          ]}
          rows={rows}
        />
      </AdminPanel>
    </section>
  );
}
